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
  is_prepayment: z.boolean().default(false)
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
      // Это доплата — заказ считается оплаченным полностью или частично
      await dbClient.query(
        `UPDATE clients SET total_spent = total_spent + $1
         WHERE id = (SELECT d.client_id FROM orders o JOIN devices d ON d.id = o.device_id WHERE o.id = $2)`,
        [input.amount, input.order_id]
      );
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
