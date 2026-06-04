import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

const createExpenseSchema = z.object({
  category_id: z.number().int().positive(),
  amount: z.number().positive('Сумма должна быть положительной'),
  description: z.string().optional(),
  order_id: z.number().int().positive().optional()
});

// GET /expenses — список расходов
expensesRouter.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { from, to, category_id } = req.query;

    let sql = `
      SELECT e.*, ec.name AS category_name
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (from) {
      sql += ` AND e.created_at >= $${idx++}`;
      params.push(from);
    }
    if (to) {
      sql += ` AND e.created_at <= $${idx++}`;
      params.push(to);
    }
    if (category_id) {
      sql += ` AND e.category_id = $${idx++}`;
      params.push(Number(category_id));
    }

    sql += ' ORDER BY e.created_at DESC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /expenses — добавить расход
expensesRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createExpenseSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO expenses (category_id, amount, description, order_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.category_id, input.amount, input.description || null, input.order_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
