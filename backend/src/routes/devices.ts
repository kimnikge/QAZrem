import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';

export const devicesRouter = Router();

const createDeviceSchema = z.object({
  client_id: z.number().int().positive(),
  brand: z.string().min(1, 'Бренд обязателен'),
  model: z.string().min(1, 'Модель обязательна'),
  imei: z.string().min(10, 'IMEI минимум 10 символов'),
  serial_number: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal(''))
});

devicesRouter.get('/client/:clientId', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      `SELECT id, client_id, brand, model, imei, serial_number, color, notes, created_at
       FROM devices WHERE client_id = $1 ORDER BY created_at DESC`,
      [clientId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, client_id, brand, model, imei, serial_number, color, notes, created_at
       FROM devices WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Устройство');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

devicesRouter.post('/', async (req, res, next) => {
  try {
    const input = createDeviceSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO devices (client_id, brand, model, imei, serial_number, color, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, client_id, brand, model, imei, serial_number, color, notes, created_at`,
      [
        input.client_id,
        input.brand,
        input.model,
        input.imei,
        input.serial_number || null,
        input.color || null,
        input.notes || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
