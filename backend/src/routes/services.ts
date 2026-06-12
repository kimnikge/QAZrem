import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const servicesRouter = Router();

servicesRouter.use(requireAuth);

// GET /services — список услуг
servicesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /services — создать услугу
const serviceSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  price: z.number().min(0).default(0),
  master_commission_pct: z.number().min(0).max(100).default(50),
});

servicesRouter.post('/', async (req, res, next) => {
  try {
    const { name, price, master_commission_pct } = serviceSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO services (name, price, master_commission_pct) VALUES ($1, $2, $3) RETURNING *',
      [name, price, master_commission_pct]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /services/:id — обновить услугу
servicesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, price, master_commission_pct } = serviceSchema.parse(req.body);
    const result = await pool.query(
      'UPDATE services SET name = $1, price = $2, master_commission_pct = $3 WHERE id = $4 RETURNING *',
      [name, price, master_commission_pct, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /services/:id
servicesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM services WHERE id = $1', [id]);
    res.json({ message: 'Удалено' });
  } catch (error) {
    next(error);
  }
});
