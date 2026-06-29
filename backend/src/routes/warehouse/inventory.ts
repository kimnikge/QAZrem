import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { buildPatchQuery } from '../../lib/query-builder.js';

export const warehouseInventoryRouter = Router();

warehouseInventoryRouter.use(requireAuth);

// ============================================================
// Схемы
// ============================================================

const createSheetSchema = z.object({
  location_id: z.number().int().positive().optional().nullable(),
  notes: z.string().optional(),
});

const updateItemSchema = z.object({
  actual_quantity: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

const createEquipmentSchema = z.object({
  name: z.string().min(1),
  master_id: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

// ============================================================
// ИНВЕНТАРИЗАЦИЯ
// ============================================================

// GET /warehouse/inventory — список ведомостей
warehouseInventoryRouter.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT s.*, u.name AS created_by_name, l.name AS location_name
      FROM inventory_sheets s
      JOIN users u ON u.id = s.created_by
      LEFT JOIN locations l ON l.id = s.location_id
    `;
    const params: unknown[] = [];

    if (status) {
      sql += ' WHERE s.status = $1';
      params.push(status);
    }

    sql += ' ORDER BY s.created_at DESC LIMIT 50';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /warehouse/inventory — создать ведомость
warehouseInventoryRouter.post('/', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const input = createSheetSchema.parse(req.body);
    await dbClient.query('BEGIN');

    const sheet = await dbClient.query(
      `INSERT INTO inventory_sheets (location_id, created_by, status)
       VALUES ($1, $2, 'draft') RETURNING *`,
      [input.location_id || null, req.user!.userId]
    );

    // Автозаполнение: все активные запчасти с текущим остатком
    await dbClient.query(
      `INSERT INTO inventory_items (sheet_id, part_id, expected_quantity)
       SELECT $1, id, quantity FROM parts WHERE is_active = TRUE`,
      [sheet.rows[0].id]
    );

    await dbClient.query('COMMIT');

    const fullSheet = await pool.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM inventory_items WHERE sheet_id = s.id)::int AS items_count
       FROM inventory_sheets s WHERE s.id = $1`,
      [sheet.rows[0].id]
    );
    res.status(201).json(fullSheet.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// ============================================================
// ОБОРУДОВАНИЕ МАСТЕРОВ (должно быть ДО /:id!)
// ============================================================

// GET /warehouse/inventory/equipment — всё оборудование
warehouseInventoryRouter.get('/equipment', async (req, res, next) => {
  try {
    const { master_id } = req.query;
    let sql = `
      SELECT e.*, u.name AS master_name
      FROM equipment e
      JOIN users u ON u.id = e.master_id
    `;
    const params: unknown[] = [];

    if (master_id) {
      sql += ' WHERE e.master_id = $1';
      params.push(Number(master_id));
    }

    sql += ' ORDER BY u.name, e.name';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /warehouse/inventory/equipment — добавить оборудование
warehouseInventoryRouter.post('/equipment', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createEquipmentSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO equipment (name, master_id, quantity, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.name, input.master_id, input.quantity, input.notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /warehouse/inventory/equipment/:id
warehouseInventoryRouter.patch('/equipment/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = createEquipmentSchema.partial().parse(req.body);

    const patch = buildPatchQuery(
      input,
      ['name', 'master_id', 'quantity', 'notes'],
      'equipment',
    );

    if (!patch) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    patch.values[patch.values.length - 1] = id;

    const result = await pool.query(`${patch.sql} RETURNING *`, patch.values);
    if (result.rows.length === 0) throw new NotFoundError('Оборудование');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /warehouse/inventory/equipment/:id
warehouseInventoryRouter.delete('/equipment/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM equipment WHERE id = $1 RETURNING *', [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Оборудование');
    res.json({ message: 'Оборудование удалено' });
  } catch (error) {
    next(error);
  }
});

// GET /warehouse/inventory/:id — строки ведомости (должен быть ПОСЛЕ /equipment!)
warehouseInventoryRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const sheet = await pool.query(
      `SELECT s.*, u.name AS created_by_name, l.name AS location_name
       FROM inventory_sheets s
       JOIN users u ON u.id = s.created_by
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE s.id = $1`,
      [id]
    );
    if (sheet.rows.length === 0) throw new NotFoundError('Ведомость');

    const items = await pool.query(
      `SELECT ii.*, p.name AS part_name, p.sku,
        (COALESCE(ii.actual_quantity, ii.expected_quantity) - ii.expected_quantity) AS discrepancy
       FROM inventory_items ii
       JOIN parts p ON p.id = ii.part_id
       WHERE ii.sheet_id = $1
       ORDER BY p.name`,
      [id]
    );

    res.json({ ...sheet.rows[0], items: items.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /warehouse/inventory/:id/status — сменить статус
warehouseInventoryRouter.patch('/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      throw new BadRequestError('Недопустимый статус');
    }

    const result = await pool.query(
      `UPDATE inventory_sheets SET status = $1${status === 'completed' ? ', completed_at = NOW()' : ''} WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Ведомость');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /warehouse/inventory/items/:itemId — обновить строку
warehouseInventoryRouter.patch('/items/:itemId', requireRole('admin'), async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const input = updateItemSchema.parse(req.body);

    const result = await pool.query(
      `UPDATE inventory_items SET actual_quantity = $1, notes = $2
       WHERE id = $3 RETURNING *`,
      [input.actual_quantity, input.notes || null, itemId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Строка ведомости');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
