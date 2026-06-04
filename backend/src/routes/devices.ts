import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

export const devicesRouter = Router();

devicesRouter.use(requireAuth);

const createDeviceSchema = z.object({
  client_id: z.number().int().positive(),
  brand: z.string().min(1, 'Бренд обязателен'),
  model: z.string().min(1, 'Модель обязательна'),
  imei: z.string().min(10, 'IMEI минимум 10 символов'),
  serial_number: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal(''))
});

// GET /devices/catalog?q= — поиск по каталогу моделей
devicesRouter.get('/catalog', async (req, res, next) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) {
      res.json([]);
      return;
    }
    const result = await pool.query(
      `SELECT DISTINCT brand, model FROM device_catalog
       WHERE brand ILIKE $1 OR model ILIKE $1
       ORDER BY brand, model LIMIT 20`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /devices/search-imei?last4= — поиск устройств по последним 4 цифрам IMEI
devicesRouter.get('/search-imei', async (req, res, next) => {
  try {
    const last4 = (req.query.last4 as string || '').trim();
    if (!last4 || last4.length < 4) {
      res.json([]);
      return;
    }
    const result = await pool.query(
      `SELECT d.id AS device_id, d.brand, d.model, d.imei,
              c.id AS client_id, c.name AS client_name, c.phone AS client_phone
       FROM devices d
       JOIN clients c ON c.id = d.client_id
       WHERE d.imei LIKE $1
       ORDER BY d.created_at DESC LIMIT 10`,
      [`%${last4}`]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
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
