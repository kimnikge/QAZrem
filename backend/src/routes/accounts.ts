import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

// GET /accounts — список касс с балансами
accountsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM company_accounts WHERE is_active = true ORDER BY sort_order'
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

// POST /accounts — создать кассу (admin)
accountsRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, type } = z.object({
      name: z.string().min(1),
      type: z.string().optional()
    }).parse(req.body);
    const result = await pool.query(
      `INSERT INTO company_accounts (name, type) VALUES ($1, $2) RETURNING *`,
      [name, type || 'cash']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

// PATCH /accounts/:id — редактировать кассу
accountsRouter.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, is_active } = z.object({
      name: z.string().min(1).optional(),
      is_active: z.boolean().optional()
    }).parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (fields.length === 0) return res.json({ message: 'Нет изменений' });
    values.push(id);
    await pool.query(
      `UPDATE company_accounts SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
    res.json({ message: 'Обновлено' });
  } catch (error) { next(error); }
});

// GET /accounts/:id/transactions — история операций по кассе
accountsRouter.get('/:id/transactions', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Проверка существования кассы
    const acc = await pool.query('SELECT id, name FROM company_accounts WHERE id = $1', [id]);
    if (acc.rows.length === 0) throw new NotFoundError('Касса');

    // Приходы от платежей
    const payments = await pool.query(
      `SELECT ps.created_at, 'payment' AS type,
        'Платёж заказа №' || o.id AS description,
        ps.amount AS income, 0 AS outcome
      FROM payment_splits ps
      JOIN payments p ON p.id = ps.payment_id
      JOIN orders o ON o.id = p.order_id
      WHERE ps.account_id = $1
      ORDER BY ps.created_at`,
      [id]
    );

    // Перемещения: приход
    const transfersIn = await pool.query(
      `SELECT ct.created_at, 'transfer_in' AS type,
        'Из «' || fa.name || '»' AS description,
        ct.amount AS income, 0 AS outcome
      FROM cash_transfers ct
      JOIN company_accounts fa ON fa.id = ct.from_account_id
      WHERE ct.to_account_id = $1
      ORDER BY ct.created_at`,
      [id]
    );

    // Перемещения: расход
    const transfersOut = await pool.query(
      `SELECT ct.created_at, 'transfer_out' AS type,
        'В «' || ta.name || '»' AS description,
        0 AS income, ct.amount AS outcome
      FROM cash_transfers ct
      JOIN company_accounts ta ON ta.id = ct.to_account_id
      WHERE ct.from_account_id = $1
      ORDER BY ct.created_at`,
      [id]
    );

    // Объединить и вычислить running balance
    const all = [...payments.rows, ...transfersIn.rows, ...transfersOut.rows]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let balance = 0;
    const transactions = all.map(t => {
      balance += Number(t.income) - Number(t.outcome);
      return { ...t, balance: String(balance) };
    });

    res.json({ account: acc.rows[0], transactions });
  } catch (error) { next(error); }
});
