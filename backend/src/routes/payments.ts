import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createPayment, deletePayment, updatePaymentMethod } from '../services/payment.service.js';

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

// POST /payments — приём платежа (делегировано сервису)
paymentsRouter.post('/', requireRole('admin', 'reception'), async (req, res, next) => {
  try {
    const input = createPaymentSchema.parse(req.body);
    const payment = await createPayment(input);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

// DELETE /payments/:id — удаление платежа (админ, делегировано сервису)
paymentsRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new BadRequestError('Некорректный ID платежа');

    await deletePayment(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// PATCH /payments/:id — обновление способа оплаты (делегировано сервису)
const updatePaymentSchema = z.object({
  payment_method_id: z.number().int().positive(),
});

paymentsRouter.patch('/:id', requireRole('admin', 'reception'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new BadRequestError('Некорректный ID платежа');
    const { payment_method_id } = updatePaymentSchema.parse(req.body);

    await updatePaymentMethod(id, payment_method_id);
    res.json({ success: true, payment_method_id });
  } catch (error) {
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
