// Лента уведомлений и настройки получателей (ТЗ Блок 11)
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { runStaleCheck } from '../services/notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// GET /notifications/types — справочник типов
notificationsRouter.get('/types', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT code, title, description FROM notification_types ORDER BY code');
    res.json(result.rows);
  } catch (error) { next(error); }
});

// GET /notifications?unread=1 — лента событий
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === 'true' || req.query.unread === '1';
    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (unreadOnly) {
      params.push(true);
      where = 'WHERE n.read_at IS NULL';
    }
    const result = await pool.query(
      `SELECT n.id, n.type_code, nt.title AS type_title, n.title, n.payload, n.created_at, n.read_at
       FROM notifications n
       JOIN notification_types nt ON nt.code = n.type_code
       ${where}
       ORDER BY n.created_at DESC
       LIMIT 100`,
      params,
    );
    const unread = await pool.query('SELECT COUNT(*)::int AS cnt FROM notifications WHERE read_at IS NULL');
    res.json({ notifications: result.rows, unread_count: unread.rows[0].cnt });
  } catch (error) { next(error); }
});

// POST /notifications/read-all — отметить все прочитанными
notificationsRouter.post('/read-all', async (_req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL');
    res.json({ message: 'Все уведомления отмечены прочитанными' });
  } catch (error) { next(error); }
});

// POST /notifications/stale-check — генерация уведомлений о залежавшихся запчастях
notificationsRouter.post('/stale-check', requireRole('admin'), async (req, res, next) => {
  try {
    const days = z.coerce.number().int().min(1).max(3650).optional().parse(req.body?.days) ?? 30;
    const created = await runStaleCheck(days);
    res.json({ message: `Создано уведомлений: ${created}`, created });
  } catch (error) { next(error); }
});

// GET /notifications/settings — админ: настройки всех получателей
notificationsRouter.get('/settings', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ns.user_id, u.name AS user_name, u.role, ns.type_code, ns.channel, ns.enabled
       FROM notification_settings ns
       JOIN users u ON u.id = ns.user_id
       ORDER BY u.name, ns.type_code`,
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

// GET /notifications/settings/mine — настройки текущего пользователя
notificationsRouter.get('/settings/mine', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT type_code, channel, enabled
       FROM notification_settings WHERE user_id = $1
       ORDER BY type_code`,
      [req.user!.userId],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

const settingSchema = z.object({
  user_id: z.number().int().positive(),
  type_code: z.string().min(1),
  channel: z.enum(['telegram', 'whatsapp', 'app']).default('app'),
  enabled: z.boolean().default(true),
});

// PUT /notifications/settings — админ: настроить канал/подписку для пользователя
notificationsRouter.put('/settings', requireRole('admin'), async (req, res, next) => {
  try {
    const input = settingSchema.parse(req.body);
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [input.user_id]);
    if (user.rows.length === 0) throw new NotFoundError('Пользователь');

    await pool.query(
      `INSERT INTO notification_settings (user_id, type_code, channel, enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, type_code) DO UPDATE
         SET channel = EXCLUDED.channel, enabled = EXCLUDED.enabled`,
      [input.user_id, input.type_code, input.channel, input.enabled],
    );
    res.json({ message: 'Настройка сохранена', ...input });
  } catch (error) { next(error); }
});

// POST /notifications/:id/read — отметить уведомление прочитанным
notificationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw new BadRequestError('Некорректный id');
    const result = await pool.query(
      'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND read_at IS NULL RETURNING id',
      [id],
    );
    if (result.rows.length === 0) throw new NotFoundError('Непрочитанное уведомление');
    res.json({ message: 'Отмечено прочитанным' });
  } catch (error) { next(error); }
});
