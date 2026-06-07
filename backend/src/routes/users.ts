import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// ============================================================
// Схемы валидации
// ============================================================

const createUserSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  login: z.string().min(3, 'Логин должен содержать минимум 3 символа'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  role: z.enum(['admin', 'master', 'reception']),
  default_commission_pct: z.number().min(0).max(100).optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  login: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'master', 'reception']).optional(),
  default_commission_pct: z.number().min(0).max(100).optional()
});

// ============================================================
// GET /users — список пользователей (без password_hash)
// ============================================================
usersRouter.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, login, default_commission_pct, created_at FROM users ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /users/masters — список мастеров (для выбора в форме заказа)
// ============================================================
usersRouter.get('/masters', requireRole('admin', 'reception'), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, default_commission_pct FROM users WHERE role = 'master' ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /users — создать пользователя (только admin)
// ============================================================
usersRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);

    // Проверяем, не занят ли логин
    const existing = await pool.query('SELECT id FROM users WHERE login = $1', [input.login]);
    if (existing.rows.length > 0) {
      throw new ConflictError('Пользователь с таким логином уже существует');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, login, password_hash, role, default_commission_pct)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, login, role, default_commission_pct, created_at`,
      [input.name, input.login, passwordHash, input.role, input.default_commission_pct ?? 50]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PATCH /users/:id — обновить пользователя (только admin)
// ============================================================
usersRouter.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = updateUserSchema.parse(req.body);

    // Проверяем, что пользователь существует
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Пользователь');
    }

    // Если меняется логин — проверяем уникальность
    if (input.login) {
      const loginCheck = await pool.query(
        'SELECT id FROM users WHERE login = $1 AND id != $2',
        [input.login, id]
      );
      if (loginCheck.rows.length > 0) {
        throw new ConflictError('Пользователь с таким логином уже существует');
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (key === 'password') {
        const hash = await bcrypt.hash(String(value), 10);
        fields.push(`password_hash = $${idx++}`);
        values.push(hash);
      } else {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, name, login, role, default_commission_pct, created_at`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /users/:id — удалить пользователя (только admin)
// ============================================================
usersRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Нельзя удалить самого себя
    if (Number(id) === req.user!.userId) {
      throw new BadRequestError('Нельзя удалить самого себя');
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, name, login, role',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Пользователь');
    }

    res.json({ message: `Пользователь "${result.rows[0].name}" удалён` });
  } catch (error) {
    next(error);
  }
});
