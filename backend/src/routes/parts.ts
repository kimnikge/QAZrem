import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError, BadRequestError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parsePagination } from '../middleware/pagination.js';

export const partsRouter = Router();

partsRouter.use(requireAuth);

// Генерация 13-значного SKU
async function generateSku(): Promise<string> {
  const result = await pool.query(
    `SELECT sku FROM parts WHERE sku ~ '^[0-9]+$' ORDER BY LENGTH(sku) DESC, sku DESC LIMIT 1`
  );
  if (result.rows.length === 0) {
    return '0000000000001';
  }
  const maxSku = result.rows[0].sku;
  const next = (BigInt(maxSku) + 1n).toString().padStart(13, '0');
  return next;
}

const createPartSchema = z.object({
  name: z.string().min(2),
  sku: z.string().optional().or(z.literal('')),
  category_id: z.number().int().positive().optional().nullable(),
  model_name: z.string().optional().or(z.literal('')),
  compatible_models: z.array(z.string()).default([]),
  purchase_price: z.number().nonnegative().default(0),
  selling_price: z.number().nonnegative().default(0),
  quantity: z.number().int().nonnegative().default(0),
  min_quantity: z.number().int().nonnegative().default(5),
  attributes: z.record(z.string(), z.unknown()).default({}),
  unit: z.string().min(1).default('шт'),
  photo_url: z.string().optional().or(z.literal('')),
  tag_ids: z.array(z.number().int().positive()).optional()
});

const updatePartSchema = createPartSchema.partial();

const movementSchema = z.object({
  part_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  document: z.string().optional(),
  order_id: z.number().int().positive().optional(),
  supplier_id: z.number().int().positive().optional(),
  supplier_sku: z.string().optional(),
  batch_number: z.string().optional(),
  purchase_price: z.number().nonnegative().optional(),
  location_id: z.number().int().positive().optional(),
});

// GET /parts — список запчастей (с фильтрами: category, tag, search, low_stock)
partsRouter.get('/', async (req, res, next) => {
  try {
    const { low_stock, category_id, tag_id, search, inactive } = req.query;

    let sql = `
      SELECT p.*,
        pc.name AS category_name,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM part_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.part_id = p.id),
          '[]'::json
        ) AS tags
      FROM parts p
      LEFT JOIN part_categories pc ON pc.id = p.category_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    // Показываем только активные по умолчанию
    if (inactive !== 'true') {
      conditions.push(`p.is_active = TRUE`);
    }

    if (low_stock === 'true') {
      conditions.push(`p.quantity <= p.min_quantity`);
    }
    if (category_id) {
      conditions.push(`p.category_id = $${idx++}`);
      params.push(Number(category_id));
    }
    if (tag_id) {
      conditions.push(`EXISTS (SELECT 1 FROM part_tags pt WHERE pt.part_id = p.id AND pt.tag_id = $${idx++})`);
      params.push(Number(tag_id));
    }
    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.model_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.name';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /parts/movements — история движения склада
partsRouter.get('/movements', parsePagination(), async (req, res, next) => {
  try {
    const { part_id, type } = req.query;
    const { limit, offset } = req.pagination;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (part_id) {
      conditions.push(`pm.part_id = $${idx++}`);
      params.push(Number(part_id));
    }
    if (type) {
      conditions.push(`pm.type = $${idx++}`);
      params.push(type);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : 'WHERE 1=1';

    const selectClause = `pm.*, p.name AS part_name, p.sku, s.name AS supplier_name`;
    const fromClause = `part_movements pm JOIN parts p ON p.id = pm.part_id LEFT JOIN suppliers s ON s.id = pm.supplier_id`;

    // Основной запрос
    const sql = `SELECT ${selectClause} FROM ${fromClause} ${whereClause}
      ORDER BY pm.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}`;

    const allParams = [...params, limit, offset];
    const result = await pool.query(sql, allParams);

    // COUNT — отдельный надёжный запрос (без regex!)
    const countSql = `SELECT COUNT(*)::int AS total FROM ${fromClause} ${whereClause}`;
    const countResult = await pool.query(countSql, params);

    res.json({
      movements: result.rows,
      total: countResult.rows[0].total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

// GET /parts/summary — сводка по складу (должен быть ДО /:id!)
partsRouter.get('/summary', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*)::int AS total_items,
        COALESCE(SUM(quantity), 0)::int AS total_quantity,
        COALESCE(SUM(purchase_price * quantity), 0) AS total_cost,
        COALESCE(SUM(selling_price * quantity), 0) AS total_value,
        COALESCE(COUNT(*) FILTER (WHERE quantity <= min_quantity), 0)::int AS low_stock_count
      FROM parts`
    );
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

// GET /parts/tags — список всех тегов (должен быть ДО /:id!)
partsRouter.get('/tags', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.*, COUNT(pt.part_id)::int AS parts_count
       FROM tags t
       LEFT JOIN part_tags pt ON pt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /parts/tags — создать тег
partsRouter.post('/tags', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestError('Название тега обязательно');
    }
    const result = await pool.query(
      `INSERT INTO tags (name, color) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [name.trim(), color || '#6b7280']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /parts/tags/:id — удалить тег
partsRouter.delete('/tags/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM tags WHERE id = $1 RETURNING *', [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Тег');
    res.json({ message: 'Тег удалён' });
  } catch (error) {
    next(error);
  }
});

// GET /parts/:id — должен быть ПОСЛЕ /summary, /movements и /tags!
partsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, pc.name AS category_name,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM part_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.part_id = p.id),
          '[]'::json
        ) AS tags
       FROM parts p
       LEFT JOIN part_categories pc ON pc.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Запчасть');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /parts/:id — удалить запчасть
partsRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;

    // Проверяем использование в заказах
    const usage = await dbClient.query(
      'SELECT COUNT(*)::int AS cnt FROM order_parts WHERE part_id = $1', [id]
    );
    if (usage.rows[0].cnt > 0) {
      throw new BadRequestError(
        `Нельзя удалить: запчасть использована в ${usage.rows[0].cnt} заказах. Деактивируйте через is_active = FALSE.`
      );
    }

    await dbClient.query('BEGIN');
    // Каскадно удалятся: part_tags, part_movements, part_batches (по FK)
    const result = await dbClient.query(
      'DELETE FROM parts WHERE id = $1 RETURNING id, name', [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Запчасть');
    await dbClient.query('COMMIT');

    res.json({ message: `Запчасть "${result.rows[0].name}" удалена` });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// POST /parts — создать запчасть
partsRouter.post('/', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const input = createPartSchema.parse(req.body);

    // Авто-генерация SKU, если не указан
    const sku = input.sku || await generateSku();

    await dbClient.query('BEGIN');

    const result = await dbClient.query(
      `INSERT INTO parts (name, sku, category_id, model_name, compatible_models,
          purchase_price, selling_price, quantity, min_quantity, attributes, unit, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.name,
        sku,
        input.category_id || null,
        input.model_name || null,
        JSON.stringify(input.compatible_models),
        input.purchase_price,
        input.selling_price,
        input.quantity,
        input.min_quantity,
        JSON.stringify(input.attributes),
        input.unit,
        input.photo_url || null
      ]
    );

    const part = result.rows[0];

    // Привязываем теги
    if (input.tag_ids && input.tag_ids.length > 0) {
      for (const tagId of input.tag_ids) {
        await dbClient.query(
          'INSERT INTO part_tags (part_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [part.id, tagId]
        );
      }
    }

    await dbClient.query('COMMIT');

    // Возвращаем с тегами
    const tagsResult = await pool.query(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN part_tags pt ON pt.tag_id = t.id WHERE pt.part_id = $1`,
      [part.id]
    );

    res.status(201).json({ ...part, tags: tagsResult.rows });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// PATCH /parts/:id
partsRouter.patch('/:id', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const input = updatePartSchema.parse(req.body);

    await dbClient.query('BEGIN');

    const { tag_ids, ...partFields } = input;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(partFields)) {
      if (value !== undefined) {
        if (key === 'compatible_models' || key === 'attributes') {
          fields.push(`${key} = $${idx++}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${idx++}`);
          values.push(value);
        }
      }
    }

    if (fields.length > 0) {
      values.push(id);
      const result = await dbClient.query(
        `UPDATE parts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (result.rows.length === 0) throw new NotFoundError('Запчасть');
    }

    // Обновляем теги, если переданы
    if (tag_ids !== undefined) {
      await dbClient.query('DELETE FROM part_tags WHERE part_id = $1', [id]);
      for (const tagId of tag_ids) {
        await dbClient.query(
          'INSERT INTO part_tags (part_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, tagId]
        );
      }
    }

    await dbClient.query('COMMIT');

    // Возвращаем полные данные
    const fullResult = await pool.query(
      `SELECT p.*, pc.name AS category_name,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM part_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.part_id = p.id),
          '[]'::json
        ) AS tags
       FROM parts p
       LEFT JOIN part_categories pc ON pc.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );
    res.json(fullResult.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// POST /parts/movement — оприходование запчасти (с партией)
partsRouter.post('/movement', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const input = movementSchema.parse(req.body);

    await dbClient.query('BEGIN');

    // Проверяем, что запчасть существует
    const part = await dbClient.query(
      'SELECT id, name, purchase_price FROM parts WHERE id = $1 FOR UPDATE',
      [input.part_id]
    );
    if (part.rows.length === 0) throw new NotFoundError('Запчасть');

    // Создаём или находим партию
    const batchNumber = input.batch_number || `BATCH-${Date.now()}`;
    const purchasePrice = input.purchase_price || part.rows[0].purchase_price;

    let batch = await dbClient.query(
      `SELECT id FROM part_batches WHERE part_id = $1 AND batch_number = $2`,
      [input.part_id, batchNumber]
    );

    let batchId: number;
    if (batch.rows.length > 0) {
      // Обновляем существующую партию
      batchId = batch.rows[0].id;
      await dbClient.query(
        `UPDATE part_batches SET current_quantity = current_quantity + $1 WHERE id = $2`,
        [input.quantity, batchId]
      );
    } else {
      // Создаём новую партию
      const newBatch = await dbClient.query(
        `INSERT INTO part_batches (part_id, batch_number, supplier_id, purchase_price,
            initial_quantity, current_quantity, received_at)
         VALUES ($1, $2, $3, $4, $5, $5, CURRENT_DATE)
         RETURNING id`,
        [input.part_id, batchNumber, input.supplier_id || null, purchasePrice, input.quantity]
      );
      batchId = newBatch.rows[0].id;
    }

    // Увеличиваем остаток
    await dbClient.query(
      'UPDATE parts SET quantity = quantity + $1 WHERE id = $2',
      [input.quantity, input.part_id]
    );

    // Запись в part_movements
    await dbClient.query(
      `INSERT INTO part_movements (part_id, type, quantity, order_id, document,
          supplier_id, supplier_sku, batch_number, batch_id, location_id)
       VALUES ($1, 'incoming', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [input.part_id, input.quantity, input.order_id || null, input.document || null,
       input.supplier_id || null, input.supplier_sku || null, batchNumber, batchId,
       input.location_id || null]
    );

    await dbClient.query('COMMIT');

    res.status(201).json({
      message: `Запчасть "${part.rows[0].name}" оприходована`,
      quantity: input.quantity,
      batch_number: batchNumber,
      batch_id: batchId
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// POST /parts/writeoff — списание запчасти (FIFO, без привязки к заказу)
partsRouter.post('/writeoff', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const input = movementSchema.parse(req.body);
    await dbClient.query('BEGIN');

    const part = await dbClient.query(
      'SELECT id, name, quantity FROM parts WHERE id = $1 FOR UPDATE',
      [input.part_id]
    );
    if (part.rows.length === 0) throw new NotFoundError('Запчасть');
    if (part.rows[0].quantity < input.quantity) {
      throw new BadRequestError(`Недостаточно на складе. Доступно: ${part.rows[0].quantity}`);
    }

    // FIFO: находим партии с остатком, от старых к новым
    const batches = await dbClient.query(
      `SELECT id, batch_number, current_quantity, purchase_price
       FROM part_batches
       WHERE part_id = $1 AND current_quantity > 0
       ORDER BY received_at ASC
       FOR UPDATE`,
      [input.part_id]
    );

    let remaining = input.quantity;
    const usedBatches: { batchId: number; batchNumber: string; qty: number; price: number }[] = [];

    for (const batch of batches.rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.current_quantity);
      remaining -= take;

      // Уменьшаем остаток партии
      await dbClient.query(
        'UPDATE part_batches SET current_quantity = current_quantity - $1 WHERE id = $2',
        [take, batch.id]
      );

      usedBatches.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        qty: take,
        price: batch.purchase_price
      });
    }

    // Проверяем, что весь объём покрыт партиями
    if (remaining > 0) {
      throw new BadRequestError(
        `Несоответствие остатков: недостаточно в партиях (не хватает ${remaining}шт). Обратитесь к админу.`
      );
    }

    // Уменьшаем общий остаток запчасти
    await dbClient.query(
      'UPDATE parts SET quantity = quantity - $1 WHERE id = $2',
      [input.quantity, input.part_id]
    );

    // Записи в part_movements (по одной на каждую использованную партию)
    for (const ub of usedBatches) {
      await dbClient.query(
        `INSERT INTO part_movements (part_id, type, quantity, order_id, document,
            batch_id, batch_number)
         VALUES ($1, 'writeoff', $2, $3, $4, $5, $6)`,
        [input.part_id, ub.qty, input.order_id || null, input.document || null,
         ub.batchId, ub.batchNumber]
      );
    }

    await dbClient.query('COMMIT');

    const batchInfo = usedBatches.map(b =>
      `партия ${b.batchNumber}: ${b.qty}шт × ${b.price}₸`
    ).join(', ');

    res.json({
      message: `Списано: "${part.rows[0].name}" ×${input.quantity}`,
      batches: batchInfo
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally { dbClient.release(); }
});
