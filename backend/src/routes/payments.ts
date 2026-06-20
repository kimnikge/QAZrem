import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

const createPaymentSchema = z.object({
  order_id: z.number().int().positive(),
  amount: z.number().positive('Сумма должна быть положительной'),
  payment_method_id: z.number().int().positive(),
  is_prepayment: z.boolean().default(false),
  splits: z.array(z.object({
    account_id: z.number().int().positive(),
    amount: z.number().positive()
  })).optional()
});

// POST /payments — приём платежа
paymentsRouter.post('/', requireRole('admin', 'reception'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const input = createPaymentSchema.parse(req.body);

    await dbClient.query('BEGIN');

    // Проверяем заказ
    const order = await dbClient.query(
      `SELECT o.id, o.cost, o.prepaid, os.is_final, os.slug
       FROM orders o
       JOIN order_statuses os ON os.id = o.status_id
       WHERE o.id = $1`,
      [input.order_id]
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');

    const { cost, prepaid, is_final } = order.rows[0];

    if (is_final) {
      throw new BadRequestError('Нельзя принять платёж по завершённому заказу');
    }

    if (input.is_prepayment) {
      // Предоплата не может быть больше полной стоимости
      if (input.amount > cost) {
        throw new BadRequestError('Предоплата не может превышать стоимость заказа');
      }
    }

    // Создаём платёж
    const payment = await dbClient.query(
      `INSERT INTO payments (order_id, amount, payment_method_id, is_prepayment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.order_id, input.amount, input.payment_method_id, input.is_prepayment]
    );

    // Обновляем предоплату в заказе
    if (input.is_prepayment) {
      await dbClient.query(
        'UPDATE orders SET prepaid = prepaid + $1 WHERE id = $2',
        [input.amount, input.order_id]
      );
    }

    // Обновляем total_spent у клиента
    if (!input.is_prepayment) {
      await dbClient.query(
        `UPDATE clients SET total_spent = total_spent + $1
         WHERE id = (SELECT d.client_id FROM orders o JOIN devices d ON d.id = o.device_id WHERE o.id = $2)`,
        [input.amount, input.order_id]
      );
    }

    // Сплитование по кассам
    const splits = input.splits || [];
    if (splits.length > 0) {
      const splitsTotal = splits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(splitsTotal - input.amount) > 0.01) {
        throw new BadRequestError(
          `Сумма разбивки (${splitsTotal}) не совпадает с суммой платежа (${input.amount})`
        );
      }
      const paymentId = payment.rows[0].id;
      for (const s of splits) {
        await dbClient.query(
          'INSERT INTO payment_splits (payment_id, account_id, amount) VALUES ($1, $2, $3)',
          [paymentId, s.account_id, s.amount]
        );
        await dbClient.query(
          'UPDATE company_accounts SET balance = balance + $1 WHERE id = $2',
          [s.amount, s.account_id]
        );
      }
    }

    await dbClient.query('COMMIT');

    res.status(201).json(payment.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// DELETE /payments/:id — удаление платежа (админ)
paymentsRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new BadRequestError('Некорректный ID платежа');

    // Получаем платёж
    const payResult = await dbClient.query(
      `SELECT p.*, o.cost, d.client_id
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN devices d ON d.id = o.device_id
       WHERE p.id = $1`,
      [id]
    );

    if (payResult.rows.length === 0) throw new NotFoundError('Платёж');

    const pay = payResult.rows[0];

    await dbClient.query('BEGIN');

    // Если предоплата — уменьшаем prepaid в заказе
    if (pay.is_prepayment) {
      await dbClient.query(
        'UPDATE orders SET prepaid = GREATEST(0, prepaid - $1) WHERE id = $2',
        [pay.amount, pay.order_id]
      );
    } else {
      // Если доплата — уменьшаем total_spent клиента
      await dbClient.query(
        'UPDATE clients SET total_spent = GREATEST(0, total_spent - $1) WHERE id = $2',
        [pay.amount, pay.client_id]
      );
    }

    // Удаляем платёж
    await dbClient.query('DELETE FROM payments WHERE id = $1', [id]);

    await dbClient.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// PATCH /payments/:id — обновление способа оплаты
const updatePaymentSchema = z.object({
  payment_method_id: z.number().int().positive()
});

paymentsRouter.patch('/:id', requireRole('admin', 'reception'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new BadRequestError('Некорректный ID платежа');
    const { payment_method_id } = updatePaymentSchema.parse(req.body);

    // Проверяем существование платежа
    const payResult = await pool.query(
      'SELECT id, refunded_at FROM payments WHERE id = $1',
      [id]
    );
    if (payResult.rows.length === 0) throw new NotFoundError('Платёж');
    if (payResult.rows[0].refunded_at) {
      throw new BadRequestError('Нельзя изменить возвращённый платёж');
    }

    // Проверяем существование метода оплаты
    const methodResult = await pool.query(
      'SELECT id FROM payment_methods WHERE id = $1',
      [payment_method_id]
    );
    if (methodResult.rows.length === 0) throw new NotFoundError('Способ оплаты');

    // Обновляем способ оплаты и сбрасываем разбивку по кассам (т.к. кассы привязаны к способу)
    await pool.query('BEGIN');
    await pool.query(
      'UPDATE payments SET payment_method_id = $1 WHERE id = $2',
      [payment_method_id, id]
    );
    // Удаляем старые сплиты — баланс касс корректируется через удаление/создание платежа
    await pool.query('DELETE FROM payment_splits WHERE payment_id = $1', [id]);
    await pool.query('COMMIT');

    res.json({ success: true, payment_method_id });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    next(error);
  }
});

// PATCH /payments/:id/refund — возврат платежа
const refundSchema = z.object({
  reason: z.string().optional()
});

paymentsRouter.patch('/:id/refund', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new BadRequestError('Некорректный ID платежа');
    const { reason } = refundSchema.parse(req.body);

    const payResult = await dbClient.query(
      `SELECT p.*, o.cost, d.client_id
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN devices d ON d.id = o.device_id
       WHERE p.id = $1`,
      [id]
    );
    if (payResult.rows.length === 0) throw new NotFoundError('Платёж');
    const pay = payResult.rows[0];

    if (pay.refunded_at) {
      throw new BadRequestError('Платёж уже возвращён');
    }

    await dbClient.query('BEGIN');

    // Помечаем платёж как возвращённый
    await dbClient.query(
      `UPDATE payments SET refunded_at = NOW(), refund_reason = $1 WHERE id = $2`,
      [reason || null, id]
    );

    // Если предоплата — уменьшаем prepaid
    if (pay.is_prepayment) {
      await dbClient.query(
        'UPDATE orders SET prepaid = GREATEST(0, prepaid - $1) WHERE id = $2',
        [pay.amount, pay.order_id]
      );
    } else {
      await dbClient.query(
        'UPDATE clients SET total_spent = GREATEST(0, total_spent - $1) WHERE id = $2',
        [pay.amount, pay.client_id]
      );
    }

    await dbClient.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// GET /payments/refunds — список всех возвратов
paymentsRouter.get('/refunds', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.amount, p.refunded_at, p.refund_reason,
        pm.name AS payment_method_name,
        o.id AS order_id, c.name AS client_name
      FROM payments p
      JOIN payment_methods pm ON pm.id = p.payment_method_id
      JOIN orders o ON o.id = p.order_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      WHERE p.refunded_at IS NOT NULL
      ORDER BY p.refunded_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});
