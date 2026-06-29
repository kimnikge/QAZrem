import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError, BadRequestError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildPatchQuery } from '../lib/query-builder.js';

export const suppliersRouter = Router();

suppliersRouter.use(requireAuth);

const createSupplierSchema = z.object({
  name: z.string().min(2),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

// GET /suppliers — список поставщиков
suppliersRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM part_movements pm WHERE pm.supplier_id = s.id) AS deliveries_count
       FROM suppliers s
       ORDER BY s.name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /suppliers/:id
suppliersRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (result.rows.length === 0) throw new NotFoundError('Поставщик');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /suppliers — создать поставщика
suppliersRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createSupplierSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.name, input.contact_person || null, input.phone || null, input.email || null, input.notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /suppliers/:id
suppliersRouter.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = updateSupplierSchema.parse(req.body);

    const patch = buildPatchQuery(
      input,
      ['name', 'contact_person', 'phone', 'email', 'notes'],
      'suppliers',
    );

    if (!patch) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    // Подставляем ID поставщика
    patch.values[patch.values.length - 1] = id;

    const result = await pool.query(
      `${patch.sql} RETURNING *`,
      patch.values,
    );

    if (result.rows.length === 0) throw new NotFoundError('Поставщик');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /suppliers/:id
suppliersRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) throw new NotFoundError('Поставщик');
    res.json({ message: 'Поставщик удалён' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /suppliers/:id/return — возврат партии поставщику
// ============================================================
suppliersRouter.post('/:id/return', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const supplierId = parseInt(req.params.id);
    const { batch_id, part_id, quantity, reason } = z.object({
      batch_id: z.number().int().positive(),
      part_id: z.number().int().positive(),
      quantity: z.number().int().positive(),
      reason: z.string().optional(),
    }).parse(req.body);

    await dbClient.query('BEGIN');

    // Проверяем партию
    const batch = await dbClient.query(
      `SELECT id, batch_number, current_quantity, supplier_id
       FROM part_batches WHERE id = $1 AND supplier_id = $2 FOR UPDATE`,
      [batch_id, supplierId]
    );
    if (batch.rows.length === 0) throw new NotFoundError('Партия у этого поставщика');

    if (batch.rows[0].current_quantity < quantity) {
      throw new BadRequestError(
        `Недостаточно в партии. Доступно: ${batch.rows[0].current_quantity}`
      );
    }

    // Уменьшаем остаток партии
    await dbClient.query(
      'UPDATE part_batches SET current_quantity = current_quantity - $1 WHERE id = $2',
      [quantity, batch_id]
    );

    // Уменьшаем общий остаток запчасти
    await dbClient.query(
      'UPDATE parts SET quantity = quantity - $1 WHERE id = $2',
      [quantity, part_id]
    );

    // Запись в part_movements
    await dbClient.query(
      `INSERT INTO part_movements (part_id, type, quantity, batch_id, batch_number, supplier_id, document)
       VALUES ($1, 'return_supplier', $2, $3, $4, $5, $6)`,
      [part_id, quantity, batch_id, batch.rows[0].batch_number, supplierId, reason || null]
    );

    await dbClient.query('COMMIT');
    res.json({
      message: `Возврат поставщику: партия ${batch.rows[0].batch_number}, ${quantity}шт`,
      reason: reason || null
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});
