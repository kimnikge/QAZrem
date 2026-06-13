import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const locationsRouter = Router();

locationsRouter.use(requireAuth);

// GET /locations — list all
locationsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, address, created_at FROM locations ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /locations — create (admin only)
const locationSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  address: z.string().optional().or(z.literal('')),
});

locationsRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const input = locationSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO locations (name, address) VALUES ($1, $2) RETURNING id, name, address, created_at',
      [input.name, input.address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /locations/:id — update (admin only)
locationsRouter.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Неверный ID' });
      return;
    }
    const input = locationSchema.parse(req.body);
    const result = await pool.query(
      'UPDATE locations SET name = $1, address = $2 WHERE id = $3 RETURNING id, name, address, created_at',
      [input.name, input.address || null, id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Локация');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /locations/:id — delete (admin only)
locationsRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Неверный ID' });
      return;
    }
    // Check usage
    const usage = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM orders WHERE location_id = $1',
      [id]
    );
    if (usage.rows[0].cnt > 0) {
      throw new BadRequestError('Нельзя удалить локацию, к которой привязаны заказы');
    }
    await pool.query('DELETE FROM locations WHERE id = $1', [id]);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});
