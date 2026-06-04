import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
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
      pool.query('SELECT id, name, login, role, created_at FROM users ORDER BY name')
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
    await pool.query('DELETE FROM payment_methods WHERE id = $1', [req.params.id]);
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
    await pool.query('DELETE FROM expense_categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (error) {
    next(error);
  }
});
