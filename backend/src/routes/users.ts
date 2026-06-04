import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /users — список пользователей (без password_hash)
usersRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, login, created_at FROM users ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /users/masters — список мастеров (для выбора в форме заказа)
usersRouter.get('/masters', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM users WHERE role = 'master' ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
