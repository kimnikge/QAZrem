import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

export const transfersRouter = Router();
transfersRouter.use(requireAuth);

// GET /transfers — история перемещений
transfersRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ct.*,
        fa.name AS from_account_name, ta.name AS to_account_name,
        u.name AS created_by_name
      FROM cash_transfers ct
      JOIN company_accounts fa ON fa.id = ct.from_account_id
      JOIN company_accounts ta ON ta.id = ct.to_account_id
      JOIN users u ON u.id = ct.created_by
      ORDER BY ct.created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

// POST /transfers — выполнить перемещение
transfersRouter.post('/', async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const { from_account_id, to_account_id, amount, comment } = z.object({
      from_account_id: z.number().int().positive(),
      to_account_id: z.number().int().positive(),
      amount: z.number().positive(),
      comment: z.string().optional()
    }).parse(req.body);

    if (from_account_id === to_account_id) {
      throw new BadRequestError('Нельзя переместить средства в ту же кассу');
    }

    await dbClient.query('BEGIN');

    // Проверить баланс
    const fromAcc = await dbClient.query(
      'SELECT balance FROM company_accounts WHERE id = $1 FOR UPDATE',
      [from_account_id]
    );
    if (fromAcc.rows.length === 0) throw new BadRequestError('Касса-источник не найдена');
    if (Number(fromAcc.rows[0].balance) < amount) {
      throw new BadRequestError('Недостаточно средств в кассе-источнике');
    }

    // Списать с from, зачислить на to
    await dbClient.query(
      'UPDATE company_accounts SET balance = balance - $1 WHERE id = $2',
      [amount, from_account_id]
    );
    await dbClient.query(
      'UPDATE company_accounts SET balance = balance + $1 WHERE id = $2',
      [amount, to_account_id]
    );

    // Запись в историю
    const result = await dbClient.query(
      `INSERT INTO cash_transfers (from_account_id, to_account_id, amount, comment, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [from_account_id, to_account_id, amount, comment || null, req.user!.userId]
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
