import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError, BadRequestError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildPatchQuery } from '../lib/query-builder.js';

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
    const input = z.object({
      name: z.string().min(1).optional(),
      is_active: z.boolean().optional(),
    }).parse(req.body);

    const patch = buildPatchQuery(input, ['name', 'is_active'], 'company_accounts');

    if (!patch) return res.json({ message: 'Нет изменений' });

    patch.values[patch.values.length - 1] = id;
    await pool.query(patch.sql, patch.values);

    res.json({ message: 'Обновлено' });
  } catch (error) { next(error); }
});

// POST /accounts/:id/operations — ручной приход/расход по кассе
accountsRouter.post('/:id/operations', async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const accountId = Number(req.params.id);
    const { type, amount, description } = z.object({
      type: z.enum(['income', 'expense']),
      amount: z.number().positive('Сумма должна быть положительной'),
      description: z.string().optional()
    }).parse(req.body);

    // Проверка существования кассы
    const acc = await dbClient.query('SELECT id, balance FROM company_accounts WHERE id = $1 FOR UPDATE', [accountId]);
    if (acc.rows.length === 0) throw new NotFoundError('Касса');

    // Для расхода — проверить что баланс не уйдёт в минус
    if (type === 'expense' && Number(acc.rows[0].balance) < amount) {
      throw new BadRequestError('Недостаточно средств в кассе');
    }

    await dbClient.query('BEGIN');

    // Обновить баланс
    if (type === 'income') {
      await dbClient.query('UPDATE company_accounts SET balance = balance + $1 WHERE id = $2', [amount, accountId]);
    } else {
      await dbClient.query('UPDATE company_accounts SET balance = balance - $1 WHERE id = $2', [amount, accountId]);
    }

    // Записать операцию
    const result = await dbClient.query(
      `INSERT INTO cash_operations (account_id, type, amount, description, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [accountId, type, amount, description || null, req.user!.userId]
    );

    await dbClient.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
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

    // Ручные операции (приход/расход)
    const manualOps = await pool.query(
      `SELECT co.created_at,
        CASE WHEN co.type = 'income' THEN 'manual_income' ELSE 'manual_expense' END AS type,
        COALESCE(co.description, CASE WHEN co.type = 'income' THEN 'Ручной приход' ELSE 'Ручной расход' END) AS description,
        CASE WHEN co.type = 'income' THEN co.amount ELSE 0 END AS income,
        CASE WHEN co.type = 'expense' THEN co.amount ELSE 0 END AS outcome
      FROM cash_operations co
      WHERE co.account_id = $1
      ORDER BY co.created_at`,
      [id]
    );

    // Объединить и вычислить running balance
    const all = [...payments.rows, ...transfersIn.rows, ...transfersOut.rows, ...manualOps.rows]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let balance = 0;
    const transactions = all.map(t => {
      balance += Number(t.income) - Number(t.outcome);
      return { ...t, balance: String(balance) };
    });

    res.json({ account: acc.rows[0], transactions });
  } catch (error) { next(error); }
});
