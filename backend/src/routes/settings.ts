import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.use(requireRole('admin'));

// GET /settings — все справочники
settingsRouter.get('/', async (_req, res, next) => {
  try {
    const [statuses, paymentMethods, expenseCategories, users] = await Promise.all([
      pool.query('SELECT id, name, slug, "order", is_final FROM order_statuses ORDER BY "order"'),
      pool.query('SELECT id, name FROM payment_methods ORDER BY id'),
      pool.query('SELECT id, name FROM expense_categories ORDER BY id'),
      pool.query('SELECT id, name, login, role, default_commission_pct, created_at FROM users ORDER BY name')
    ]);

    res.json({
      order_statuses: statuses.rows,
      payment_methods: paymentMethods.rows,
      expense_categories: expenseCategories.rows,
      users: users.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /settings/payment-methods — добавить способ оплаты
const paymentMethodSchema = z.object({ name: z.string().min(1) });

settingsRouter.post('/payment-methods', async (req, res, next) => {
  try {
    const { name } = paymentMethodSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO payment_methods (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /settings/payment-methods/:id
settingsRouter.delete('/payment-methods/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Проверяем, есть ли платежи с этим способом
    const usage = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM payments WHERE payment_method_id = $1',
      [id]
    );
    if (usage.rows[0].cnt > 0) {
      throw new BadRequestError('Нельзя удалить способ оплаты, по которому есть платежи');
    }
    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
    res.json({ message: 'Удалено' });
  } catch (error) {
    next(error);
  }
});

// POST /settings/expense-categories — добавить категорию расходов
settingsRouter.post('/expense-categories', async (req, res, next) => {
  try {
    const { name } = paymentMethodSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO expense_categories (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /settings/expense-categories/:id
settingsRouter.delete('/expense-categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Проверяем, есть ли расходы с этой категорией
    const usage = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM expenses WHERE category_id = $1',
      [id]
    );
    if (usage.rows[0].cnt > 0) {
      throw new BadRequestError('Нельзя удалить категорию расходов, по которой есть расходы');
    }
    await pool.query('DELETE FROM expense_categories WHERE id = $1', [id]);
    res.json({ message: 'Удалено' });
  } catch (error) {
    next(error);
  }
});
