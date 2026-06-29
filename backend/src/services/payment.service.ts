// ═══════════════════════════════════════════════════════════
// Payment Service — бизнес-логика платежей.
//
// Вынесена из routes/payments.ts.
// ═══════════════════════════════════════════════════════════

import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

export interface CreatePaymentInput {
  order_id: number;
  amount: number;
  payment_method_id: number;
  is_prepayment?: boolean;
  splits?: Array<{ account_id: number; amount: number }>;
}

export interface PaymentRow {
  id: number;
  order_id: number;
  amount: string;
  payment_method_id: number;
  is_prepayment: boolean;
  created_at: string;
  refunded_at: string | null;
  refund_reason: string | null;
}

/**
 * Создать платёж с проверками бизнес-правил:
 * - Заказ не финальный
 * - Предоплата ≤ стоимость заказа
 * - Сумма сплитов = сумма платежа
 * - Обновление баланса касс
 */
export async function createPayment(input: CreatePaymentInput): Promise<PaymentRow> {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Проверяем заказ
    const order = await dbClient.query(
      `SELECT o.id, o.cost, o.prepaid, os.is_final, os.slug
       FROM orders o
       JOIN order_statuses os ON os.id = o.status_id
       WHERE o.id = $1`,
      [input.order_id],
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');

    const { cost, is_final } = order.rows[0];

    if (is_final) {
      throw new BadRequestError('Нельзя принять платёж по завершённому заказу');
    }

    if (input.is_prepayment && input.amount > Number(cost)) {
      throw new BadRequestError('Предоплата не может превышать стоимость заказа');
    }

    // Создаём платёж
    const payment = await dbClient.query(
      `INSERT INTO payments (order_id, amount, payment_method_id, is_prepayment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.order_id, input.amount, input.payment_method_id, input.is_prepayment ?? false],
    );

    // Обновляем предоплату в заказе
    if (input.is_prepayment) {
      await dbClient.query(
        'UPDATE orders SET prepaid = prepaid + $1 WHERE id = $2',
        [input.amount, input.order_id],
      );
    }

    // Обновляем total_spent у клиента (только для доплат)
    if (!input.is_prepayment) {
      await dbClient.query(
        `UPDATE clients SET total_spent = total_spent + $1
         WHERE id = (
           SELECT d.client_id FROM orders o
           JOIN devices d ON d.id = o.device_id
           WHERE o.id = $2
         )`,
        [input.amount, input.order_id],
      );
    }

    // Сплитование по кассам
    const splits = input.splits ?? [];
    if (splits.length > 0) {
      const splitsTotal = splits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(splitsTotal - input.amount) > 0.01) {
        throw new BadRequestError(
          `Сумма разбивки (${splitsTotal}) не совпадает с суммой платежа (${input.amount})`,
        );
      }
      const paymentId = payment.rows[0].id;
      for (const s of splits) {
        await dbClient.query(
          'INSERT INTO payment_splits (payment_id, account_id, amount) VALUES ($1, $2, $3)',
          [paymentId, s.account_id, s.amount],
        );
        await dbClient.query(
          'UPDATE company_accounts SET balance = balance + $1 WHERE id = $2',
          [s.amount, s.account_id],
        );
      }
    }

    await dbClient.query('COMMIT');
    return payment.rows[0];
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
}

/**
 * Удалить платёж с корректировкой балансов.
 */
export async function deletePayment(paymentId: number): Promise<void> {
  const dbClient = await pool.connect();
  try {
    const payResult = await dbClient.query(
      `SELECT p.*, o.cost, d.client_id
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN devices d ON d.id = o.device_id
       WHERE p.id = $1`,
      [paymentId],
    );
    if (payResult.rows.length === 0) throw new NotFoundError('Платёж');

    const pay = payResult.rows[0];

    await dbClient.query('BEGIN');

    // Корректировка предоплаты
    if (pay.is_prepayment) {
      await dbClient.query(
        'UPDATE orders SET prepaid = GREATEST(0, prepaid - $1) WHERE id = $2',
        [pay.amount, pay.order_id],
      );
    } else {
      await dbClient.query(
        'UPDATE clients SET total_spent = GREATEST(0, total_spent - $1) WHERE id = $2',
        [pay.amount, pay.client_id],
      );
    }

    // Удаляем сплиты (если есть) и корректируем балансы касс
    const splits = await dbClient.query(
      'SELECT account_id, amount FROM payment_splits WHERE payment_id = $1',
      [paymentId],
    );
    for (const s of splits.rows) {
      await dbClient.query(
        'UPDATE company_accounts SET balance = GREATEST(0, balance - $1) WHERE id = $2',
        [s.amount, s.account_id],
      );
    }
    await dbClient.query('DELETE FROM payment_splits WHERE payment_id = $1', [paymentId]);

    // Удаляем платёж
    await dbClient.query('DELETE FROM payments WHERE id = $1', [paymentId]);

    await dbClient.query('COMMIT');
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
}

/**
 * Обновить способ оплаты платежа.
 */
export async function updatePaymentMethod(
  paymentId: number,
  paymentMethodId: number,
): Promise<void> {
  const dbClient = await pool.connect();
  try {
    const payResult = await dbClient.query(
      'SELECT id, refunded_at FROM payments WHERE id = $1',
      [paymentId],
    );
    if (payResult.rows.length === 0) throw new NotFoundError('Платёж');
    if (payResult.rows[0].refunded_at) {
      throw new BadRequestError('Нельзя изменить возвращённый платёж');
    }

    const methodResult = await dbClient.query(
      'SELECT id FROM payment_methods WHERE id = $1',
      [paymentMethodId],
    );
    if (methodResult.rows.length === 0) throw new NotFoundError('Способ оплаты');

    await dbClient.query('BEGIN');

    // Корректируем балансы касс от старых сплитов
    const oldSplits = await dbClient.query(
      'SELECT account_id, amount FROM payment_splits WHERE payment_id = $1',
      [paymentId],
    );
    for (const s of oldSplits.rows) {
      await dbClient.query(
        'UPDATE company_accounts SET balance = GREATEST(0, balance - $1) WHERE id = $2',
        [s.amount, s.account_id],
      );
    }
    await dbClient.query('DELETE FROM payment_splits WHERE payment_id = $1', [paymentId]);

    // Обновляем способ оплаты
    await dbClient.query(
      'UPDATE payments SET payment_method_id = $1 WHERE id = $2',
      [paymentMethodId, paymentId],
    );

    await dbClient.query('COMMIT');
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
}
