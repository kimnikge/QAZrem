import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const orderGroupsRouter = Router();

orderGroupsRouter.use(requireAuth);

// GET /order-groups — список групп
orderGroupsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT og.*, COUNT(o.id)::int AS order_count
       FROM order_groups og
       LEFT JOIN orders o ON o.group_id = og.id
       GROUP BY og.id
       ORDER BY og.name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /order-groups — создать группу
const createGroupSchema = z.object({
  name: z.string().min(1, 'Название группы обязательно')
});

orderGroupsRouter.post('/', async (req, res, next) => {
  try {
    const { name } = createGroupSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO order_groups (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /order-groups/:id — переименовать группу
orderGroupsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = createGroupSchema.parse(req.body);
    const result = await pool.query(
      'UPDATE order_groups SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /order-groups/:id
orderGroupsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM order_groups WHERE id = $1', [id]);
    res.json({ message: 'Удалено' });
  } catch (error) {
    next(error);
  }
});
