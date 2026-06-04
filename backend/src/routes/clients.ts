import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';

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

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value || null);
      }
    }

    if (fields.length === 0) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE clients SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, name, phone, email, address, total_spent, created_at`,
      values
    );

    if (result.rows.length === 0) throw new NotFoundError('Клиент');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
