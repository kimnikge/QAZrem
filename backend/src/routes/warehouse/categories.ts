import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { buildPatchQuery } from '../../lib/query-builder.js';

export const warehouseCategoriesRouter = Router();

warehouseCategoriesRouter.use(requireAuth);

// ============================================================
// Схемы
// ============================================================

const createCategorySchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  parent_id: z.number().int().positive().optional().nullable(),
});

const updateCategorySchema = createCategorySchema.partial();

const createAttributeSchema = z.object({
  name: z.string().min(1, 'Название атрибута обязательно'),
  attr_type: z.enum(['string', 'number', 'boolean', 'select']).default('string'),
  attr_options: z.array(z.string()).optional(),
  sort_order: z.number().int().nonnegative().default(0),
  is_required: z.boolean().default(false),
});

const updateAttributeSchema = createAttributeSchema.partial();

// ============================================================
// КАТЕГОРИИ
// ============================================================

// GET /warehouse/categories — дерево категорий
warehouseCategoriesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, parent_id, created_at,
        (SELECT COUNT(*) FROM (
          SELECT part_id FROM part_category_links WHERE category_id = pc.id
          UNION
          SELECT id FROM parts WHERE category_id = pc.id
        ) x)::int AS parts_count
       FROM part_categories pc
       ORDER BY COALESCE(parent_id, id), parent_id NULLS FIRST, name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /warehouse/categories/tree — вложенное дерево
warehouseCategoriesRouter.get('/tree', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `WITH RECURSIVE tree AS (
        SELECT id, name, parent_id, 0 AS depth, ARRAY[name]::text[] AS path
        FROM part_categories
        WHERE parent_id IS NULL
        UNION ALL
        SELECT c.id, c.name, c.parent_id, t.depth + 1, t.path || c.name
        FROM part_categories c
        JOIN tree t ON t.id = c.parent_id
      )
      SELECT id, name, parent_id, depth, path FROM tree ORDER BY path`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /warehouse/categories/:id
warehouseCategoriesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT pc.*,
        (SELECT COUNT(*) FROM (
          SELECT part_id FROM part_category_links WHERE category_id = pc.id
          UNION
          SELECT id FROM parts WHERE category_id = pc.id
        ) x)::int AS parts_count,
        (SELECT COUNT(*) FROM part_categories WHERE parent_id = pc.id)::int AS children_count
       FROM part_categories pc WHERE pc.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Категория');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /warehouse/categories — создать категорию
warehouseCategoriesRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createCategorySchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO part_categories (name, parent_id) VALUES ($1, $2) RETURNING *`,
      [input.name, input.parent_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /warehouse/categories/:id
warehouseCategoriesRouter.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = updateCategorySchema.parse(req.body);

    const patch = buildPatchQuery(input, ['name', 'parent_id'], 'part_categories');

    if (!patch) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    patch.values[patch.values.length - 1] = id;

    const result = await pool.query(`${patch.sql} RETURNING *`, patch.values);
    if (result.rows.length === 0) throw new NotFoundError('Категория');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /warehouse/categories/:id
warehouseCategoriesRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    // Проверяем, есть ли запчасти в категории (включая M2M-связи)
    const partsCount = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM (
        SELECT part_id FROM part_category_links WHERE category_id = $1
        UNION
        SELECT id FROM parts WHERE category_id = $1
      ) x`,
      [id]
    );
    if (partsCount.rows[0].cnt > 0) {
      throw new BadRequestError(
        `Нельзя удалить категорию: в ней ${partsCount.rows[0].cnt} запчастей. Переместите их в другую категорию.`
      );
    }

    const result = await pool.query(
      'DELETE FROM part_categories WHERE id = $1 RETURNING *', [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Категория');
    res.json({ message: 'Категория удалена' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// ЗАПЧАСТИ КАТЕГОРИИ (M2M)
// ============================================================

// GET /warehouse/categories/:id/parts — запчасти категории
warehouseCategoriesRouter.get('/:id/parts', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.id, p.name, p.sku, p.quantity, p.selling_price, p.model_name, p.unit,
        pcl.is_primary
       FROM part_category_links pcl
       JOIN parts p ON p.id = pcl.part_id
       WHERE pcl.category_id = $1 AND p.is_active = TRUE
       ORDER BY pcl.is_primary DESC, p.name`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// АТРИБУТЫ КАТЕГОРИЙ
// ============================================================

// GET /warehouse/categories/:id/attributes — атрибуты категории
warehouseCategoriesRouter.get('/:id/attributes', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM category_attributes WHERE category_id = $1 ORDER BY sort_order`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /warehouse/categories/:id/attributes — добавить атрибут
warehouseCategoriesRouter.post('/:id/attributes', requireRole('admin'), async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const input = createAttributeSchema.parse(req.body);

    // Проверяем, что категория существует
    const cat = await pool.query('SELECT id FROM part_categories WHERE id = $1', [categoryId]);
    if (cat.rows.length === 0) throw new NotFoundError('Категория');

    const result = await pool.query(
      `INSERT INTO category_attributes (category_id, name, attr_type, attr_options, sort_order, is_required)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [categoryId, input.name, input.attr_type,
       input.attr_options ? JSON.stringify(input.attr_options) : null,
       input.sort_order, input.is_required]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /warehouse/categories/attributes/:attrId
warehouseCategoriesRouter.patch('/attributes/:attrId', requireRole('admin'), async (req, res, next) => {
  try {
    const { attrId } = req.params;
    const input = updateAttributeSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        if (key === 'attr_options') {
          fields.push(`attr_options = $${idx++}`);
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

    values.push(attrId);
    const result = await pool.query(
      `UPDATE category_attributes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) throw new NotFoundError('Атрибут');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /warehouse/categories/attributes/:attrId
warehouseCategoriesRouter.delete('/attributes/:attrId', requireRole('admin'), async (req, res, next) => {
  try {
    const { attrId } = req.params;
    const result = await pool.query(
      'DELETE FROM category_attributes WHERE id = $1 RETURNING *', [attrId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Атрибут');
    res.json({ message: 'Атрибут удалён' });
  } catch (error) {
    next(error);
  }
});
