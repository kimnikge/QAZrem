// Управление гибкими правами доступа (ТЗ Блок 10)
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { hasPermission, PERMISSIONS } from '../lib/permissions.js';

export const permissionsRouter = Router();

permissionsRouter.use(requireAuth);

// GET /permissions/check?permission=... — есть ли право у текущего пользователя (для скрытия UI)
permissionsRouter.get('/check', async (req, res, next) => {
  try {
    const permission = String(req.query.permission || '');
    if (!permission) throw new BadRequestError('Укажите параметр permission');
    const allowed = await hasPermission(req.user!.userId, req.user!.role, permission);
    res.json({ permission, allowed });
  } catch (error) {
    next(error);
  }
});

// GET /permissions — админ: каталог прав, права ролей и индивидуальные переопределения
permissionsRouter.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const [roles, overrides] = await Promise.all([
      pool.query('SELECT role, permission FROM role_permissions ORDER BY role, permission'),
      pool.query(
        `SELECT o.user_id, u.name AS user_name, u.role, o.permission, o.allowed
         FROM user_permission_overrides o
         JOIN users u ON u.id = o.user_id
         ORDER BY u.name, o.permission`,
      ),
    ]);
    res.json({ permissions: PERMISSIONS, roles: roles.rows, overrides: overrides.rows });
  } catch (error) {
    next(error);
  }
});

const setPermissionSchema = z
  .object({
    role: z.enum(['master', 'reception']).optional(),
    user_id: z.number().int().positive().optional(),
    permission: z.string().min(1),
    allowed: z.boolean(),
  })
  .refine((d) => (d.role !== undefined) !== (d.user_id !== undefined), {
    message: 'Укажите ровно одно: role или user_id',
  });

// PUT /permissions — админ: выдать/забрать право роли или конкретному пользователю
permissionsRouter.put('/', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const input = setPermissionSchema.parse(req.body);

    if (input.role !== undefined) {
      if (input.allowed) {
        await dbClient.query(
          'INSERT INTO role_permissions (role, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [input.role, input.permission],
        );
      } else {
        await dbClient.query(
          'DELETE FROM role_permissions WHERE role = $1 AND permission = $2',
          [input.role, input.permission],
        );
      }
      res.json({ role: input.role, permission: input.permission, allowed: input.allowed });
      return;
    }

    const user = await dbClient.query('SELECT id FROM users WHERE id = $1', [input.user_id]);
    if (user.rows.length === 0) throw new NotFoundError('Пользователь');

    await dbClient.query(
      `INSERT INTO user_permission_overrides (user_id, permission, allowed)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, permission) DO UPDATE SET allowed = EXCLUDED.allowed`,
      [input.user_id, input.permission, input.allowed],
    );
    res.json({ user_id: input.user_id, permission: input.permission, allowed: input.allowed });
  } catch (error) {
    next(error);
  } finally {
    dbClient.release();
  }
});

// DELETE /permissions/overrides/:userId/:permission — админ: сбросить индивидуальное переопределение
permissionsRouter.delete('/overrides/:userId/:permission', requireRole('admin'), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { permission } = req.params;
    const result = await pool.query(
      'DELETE FROM user_permission_overrides WHERE user_id = $1 AND permission = $2 RETURNING *',
      [userId, permission],
    );
    if (result.rows.length === 0) throw new NotFoundError('Переопределение');
    res.json({ message: 'Переопределение сброшено' });
  } catch (error) {
    next(error);
  }
});
