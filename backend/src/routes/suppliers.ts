import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

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

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value || null);
      }
    }

    if (fields.length === 0) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE suppliers SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING *`,
      values
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
