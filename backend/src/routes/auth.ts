import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const authRouter = Router();

const JWT_SECRET = env.JWT_SECRET;
const TOKEN_EXPIRY = '24h';

const loginSchema = z.object({
  login: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен')
});

const registerSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  login: z.string().min(3, 'Логин должен содержать минимум 3 символа'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  role: z.enum(['admin', 'master', 'reception'])
});

// Регистрация — только для админов (закрытая система, непубличная)
authRouter.post('/register', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);

    // Проверяем, не занят ли логин
    const existing = await pool.query('SELECT id FROM users WHERE login = $1', [input.login]);
    if (existing.rows.length > 0) {
      throw new ConflictError('Пользователь с таким логином уже существует');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, login, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, login, role, created_at`,
      [input.name, input.login, passwordHash, input.role]
    );

    const user = result.rows[0];

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, name, login, role, password_hash FROM users WHERE login = $1',
      [input.login]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Неверный логин или пароль');
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(input.password, user.password_hash);

    if (!passwordValid) {
      throw new UnauthorizedError('Неверный логин или пароль');
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role
      },
      token
    });
  } catch (error) {
    next(error);
  }
});
