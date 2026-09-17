import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const catalogRouter = Router();

catalogRouter.use(requireAuth);

/** Ошибка уникального ограничения Postgres (код 23505) */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === '23505';
}

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
// (мутация — только с правом catalog.manage: раньше был доступен любому авторизованному)
catalogRouter.post('/', requirePermission('catalog.manage'), async (req, res, next) => {
  try {
    const input = catalogItemSchema.parse(req.body);

    // Вставка с ON CONFLICT: без SELECT-then-INSERT гонки (два параллельных
    // запроса раньше могли оба пройти проверку и один падал с 500).
    let result;
    try {
      result = await pool.query(
        `INSERT INTO device_catalog (brand, model, group_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (brand, model) DO NOTHING
         RETURNING id, brand, model, group_name`,
        [input.brand, input.model, input.group_name || null]
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: 'Такое устройство уже есть в каталоге' });
        return;
      }
      throw error;
    }

    if (result.rows.length === 0) {
      res.status(409).json({ error: 'Такое устройство уже есть в каталоге' });
      return;
    }

    // Auto-sync group to order_groups
    if (input.group_name) {
      await pool.query(
        `INSERT INTO order_groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [input.group_name]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /catalog/:id — update device in catalog (только catalog.manage)
catalogRouter.put('/:id', requirePermission('catalog.manage'), async (req, res, next) => {
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
    ).catch((error: unknown) => {
      // Гонка между SELECT-проверкой и UPDATE: уникальный конфликт → 409, а не 500
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: 'Такое устройство уже есть в каталоге' });
        return { rows: [] as Array<{ id: number; brand: string; model: string; group_name: string | null }> };
      }
      throw error;
    });
    if (result.rows.length === 0) {
      if (!res.headersSent) throw new NotFoundError('Устройство в каталоге');
      return;
    }

    // Auto-sync group to order_groups
    if (input.group_name) {
      await pool.query(
        `INSERT INTO order_groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [input.group_name]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /catalog/:id — remove device from catalog (только catalog.manage)
catalogRouter.delete('/:id', requirePermission('catalog.manage'), async (req, res, next) => {
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

// POST /catalog/import — bulk import from array (только catalog.manage)
catalogRouter.post('/import', requirePermission('catalog.manage'), async (req, res, next) => {
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
      const result = await pool.query(
        `INSERT INTO device_catalog (brand, model, group_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (brand, model) DO NOTHING`,
        [item.brand, item.model, item.group_name || null]
      );
      // rowCount = 1 только если строка реально вставлена (раньше считались
      // и конфликтные строки, из-за чего «inserted» завышался)
      if (result.rowCount === 1) inserted++;
      else skipped++;
    }

    // Auto-sync groups to order_groups
    const uniqueGroups = [...new Set(items.map(i => i.group_name).filter(Boolean))];
    for (const g of uniqueGroups) {
      await pool.query(
        `INSERT INTO order_groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [g]
      );
    }

    res.json({ inserted, skipped, total: items.length });
  } catch (error) {
    next(error);
  }
});
