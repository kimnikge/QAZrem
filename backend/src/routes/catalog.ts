import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

export const catalogRouter = Router();

catalogRouter.use(requireAuth);

// Schema for create/update
const catalogItemSchema = z.object({
  brand: z.string().min(1, 'Бренд обязателен'),
  model: z.string().min(1, 'Модель обязательна'),
  group_name: z.string().optional().or(z.literal('')),
});

// GET /catalog — list with search, filter by group, pagination
catalogRouter.get('/', async (req, res, next) => {
  try {
    const search = (req.query.search as string || '').trim();
    const group = (req.query.group as string || '').trim();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      where += ` AND (brand ILIKE $${paramIdx} OR model ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (group) {
      where += ` AND group_name = $${paramIdx}`;
      params.push(group);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM device_catalog ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT id, brand, model, group_name
       FROM device_catalog ${where}
       ORDER BY group_name NULLS LAST, brand, model
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    // Get distinct groups for filter dropdown
    const groupsResult = await pool.query(
      `SELECT DISTINCT group_name FROM device_catalog WHERE group_name IS NOT NULL ORDER BY group_name`
    );

    res.json({ items: result.rows, total, groups: groupsResult.rows.map(r => r.group_name) });
  } catch (error) {
    next(error);
  }
});

// POST /catalog — add new device to catalog
catalogRouter.post('/', async (req, res, next) => {
  try {
    const input = catalogItemSchema.parse(req.body);

    // Check for duplicate
    const existing = await pool.query(
      'SELECT id FROM device_catalog WHERE brand = $1 AND model = $2',
      [input.brand, input.model]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Такое устройство уже есть в каталоге' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO device_catalog (brand, model, group_name)
       VALUES ($1, $2, $3)
       RETURNING id, brand, model, group_name`,
      [input.brand, input.model, input.group_name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /catalog/:id — update device in catalog
catalogRouter.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Неверный ID' });
      return;
    }

    const input = catalogItemSchema.parse(req.body);

    // Check duplicate (exclude self)
    const existing = await pool.query(
      'SELECT id FROM device_catalog WHERE brand = $1 AND model = $2 AND id != $3',
      [input.brand, input.model, id]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Такое устройство уже есть в каталоге' });
      return;
    }

    const result = await pool.query(
      `UPDATE device_catalog
       SET brand = $1, model = $2, group_name = $3
       WHERE id = $4
       RETURNING id, brand, model, group_name`,
      [input.brand, input.model, input.group_name || null, id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Устройство в каталоге');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /catalog/:id — remove device from catalog
catalogRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Неверный ID' });
      return;
    }
    const result = await pool.query(
      'DELETE FROM device_catalog WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Устройство в каталоге');
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// POST /catalog/import — bulk import from array
catalogRouter.post('/import', async (req, res, next) => {
  try {
    const items = z.array(
      z.object({
        brand: z.string().min(1),
        model: z.string().min(1),
        group_name: z.string().optional().or(z.literal('')),
      })
    ).parse(req.body);

    if (items.length === 0) {
      res.status(400).json({ error: 'Пустой список' });
      return;
    }

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        await pool.query(
          `INSERT INTO device_catalog (brand, model, group_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (brand, model) DO NOTHING`,
          [item.brand, item.model, item.group_name || null]
        );
        inserted++;
      } catch {
        skipped++;
      }
    }

    res.json({ inserted, skipped, total: items.length });
  } catch (error) {
    next(error);
  }
});
