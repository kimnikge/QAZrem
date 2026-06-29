import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { buildPatchQuery } from '../lib/query-builder.js';

export const clientsRouter = Router();

const createClientSchema = z.object({
  name: z.string().min(2, 'Имя минимум 2 символа'),
  phone: z.string().min(5, 'Телефон минимум 5 символов'),
  email: z.string().email('Некорректный email').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal(''))
});

clientsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, address, total_spent, created_at
       FROM clients ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

clientsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, phone, email, address, total_spent, created_at
       FROM clients WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Клиент');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

clientsRouter.post('/', async (req, res, next) => {
  try {
    const input = createClientSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO clients (name, phone, email, address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, email, address, total_spent, created_at`,
      [input.name, input.phone, input.email || null, input.address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

clientsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = createClientSchema.partial().parse(req.body);

    const patch = buildPatchQuery(
      input,
      ['name', 'phone', 'email', 'address'],
      'clients',
    );

    if (!patch) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    // Подставляем ID клиента
    patch.values[patch.values.length - 1] = id;

    const result = await pool.query(
      `${patch.sql} RETURNING id, name, phone, email, address, total_spent, created_at`,
      patch.values,
    );

    if (result.rows.length === 0) throw new NotFoundError('Клиент');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
