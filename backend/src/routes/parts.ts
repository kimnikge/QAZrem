import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const partsRouter = Router();

partsRouter.use(requireAuth);

const createPartSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(1),
  compatible_models: z.array(z.string()).default([]),
  purchase_price: z.number().nonnegative().default(0),
  selling_price: z.number().nonnegative().default(0),
  quantity: z.number().int().nonnegative().default(0),
  min_quantity: z.number().int().nonnegative().default(5)
});

const movementSchema = z.object({
  part_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  document: z.string().optional(),
  order_id: z.number().int().positive().optional()
});

// GET /parts — список запчастей (с фильтром low_stock)
partsRouter.get('/', async (req, res, next) => {
  try {
    const { low_stock } = req.query;

    let sql = `SELECT * FROM parts`;
    const params: unknown[] = [];

    if (low_stock === 'true') {
      sql += ' WHERE quantity <= min_quantity';
    }

    sql += ' ORDER BY name';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /parts/movements — история движения склада
partsRouter.get('/movements', async (req, res, next) => {
  try {
    const { part_id, type, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const offsetNum = Math.max(parseInt(offset as string, 10) || 0, 0);

    let sql = `
      SELECT pm.*, p.name AS part_name, p.sku
      FROM part_movements pm
      JOIN parts p ON p.id = pm.part_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (part_id) {
      sql += ` AND pm.part_id = $${idx++}`;
      params.push(Number(part_id));
    }
    if (type) {
      sql += ` AND pm.type = $${idx++}`;
      params.push(type);
    }

    const countSql = sql.replace(
      /SELECT[\s\S]*?FROM/,
      'SELECT COUNT(*)::int AS total FROM'
    );
    const countResult = await pool.query(countSql, params);

    sql += ' ORDER BY pm.created_at DESC';
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offsetNum);

    const result = await pool.query(sql, params);
    res.json({
      movements: result.rows,
      total: countResult.rows[0].total,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (error) {
    next(error);
  }
});

// GET /parts/:id
partsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM parts WHERE id = $1', [id]);
    if (result.rows.length === 0) throw new NotFoundError('Запчасть');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /parts — создать запчасть
partsRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createPartSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO parts (name, sku, compatible_models, purchase_price, selling_price, quantity, min_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.name,
        input.sku,
        JSON.stringify(input.compatible_models),
        input.purchase_price,
        input.selling_price,
        input.quantity,
        input.min_quantity
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /parts/:id
partsRouter.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = createPartSchema.partial().parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        if (key === 'compatible_models') {
          fields.push(`compatible_models = $${idx++}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${idx++}`);
          values.push(value);
        }
      }
    }

    if (fields.length === 0) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE parts SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) throw new NotFoundError('Запчасть');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /parts/movement — оприходование запчасти
partsRouter.post('/movement', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const input = movementSchema.parse(req.body);

    await dbClient.query('BEGIN');

    // Проверяем, что запчасть существует
    const part = await dbClient.query('SELECT id, name FROM parts WHERE id = $1', [input.part_id]);
    if (part.rows.length === 0) throw new NotFoundError('Запчасть');

    // Увеличиваем остаток
    await dbClient.query(
      'UPDATE parts SET quantity = quantity + $1 WHERE id = $2',
      [input.quantity, input.part_id]
    );

    // Запись в part_movements
    await dbClient.query(
      `INSERT INTO part_movements (part_id, type, quantity, order_id, document)
       VALUES ($1, 'incoming', $2, $3, $4)`,
      [input.part_id, input.quantity, input.order_id || null, input.document || null]
    );

    await dbClient.query('COMMIT');

    res.status(201).json({
      message: `Запчасть "${part.rows[0].name}" оприходована`,
      quantity: input.quantity
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});
