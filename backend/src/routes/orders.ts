import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/withTransaction.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { idParamSchema } from '../lib/validation.js';
import { buildOrderWhere } from '../lib/order-filters.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parsePagination } from '../middleware/pagination.js';
import {
  createOrder,
  updateOrderStatus,
  assignPartToOrder,
  recalcOrderCost,
} from '../services/order.service.js';
import { depositPartLocation } from '../lib/part-locations.js';
import { STATUS_TRANSITIONS } from '../types/domain.js';
import { createNotification, checkStockAlerts } from '../services/notifications.service.js';

export const ordersRouter = Router();

// Все роуты заказов требуют авторизации
ordersRouter.use(requireAuth);

// ============================================================
// Схемы валидации
// ============================================================

const orderPartSchema = z.object({
  part_id: z.number().int().positive(),
  quantity: z.number().int().positive()
});

const orderServiceSchema = z.object({
  service_id: z.number().int().positive(),
  quantity: z.number().int().positive().default(1)
});

// Общие поля заказа — один раз, чтобы не дублировать в двух схемах создания
const orderCommonFields = {
  issue_description: z.string().min(5, 'Опишите проблему минимум 5 символов'),
  master_id: z.number().int().positive().optional(),
  master_commission_pct: z.number().min(0).max(100).optional(),
  deadline: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'critical']).optional(),
  source: z.string().min(1, 'Укажите откуда пришёл клиент'),
  estimated_cost: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  parts: z.array(orderPartSchema).optional(),
  services: z.array(orderServiceSchema).optional(),
  group_id: z.number().int().positive().optional().nullable(),
  location_id: z.number().int().positive().optional().nullable(),
  password: z.string().optional().or(z.literal('')),
  face_id: z.boolean().optional(),
  completeness: z.string().optional().or(z.literal('')),
  condition: z.string().optional().or(z.literal('')),
  appearance: z.string().optional().or(z.literal('')),
  manager_notes: z.string().optional().or(z.literal('')),
  order_type: z.enum(['paid', 'warranty']).optional(),
  image_url: z.string().optional().or(z.literal(''))
};

const createOrderWithNewDeviceSchema = z.object({
  ...orderCommonFields,
  client: z.object({
    name: z.string().min(2),
    phone: z.string().min(5),
    email: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal(''))
  }),
  device: z.object({
    brand: z.string().min(1),
    model: z.string().min(1),
    imei: z.string().min(10),
    serial_number: z.string().optional().or(z.literal('')),
    color: z.string().optional().or(z.literal(''))
  })
});

const createOrderWithExistingDeviceSchema = z.object({
  ...orderCommonFields,
  device_id: z.number().int().positive()
});

const updateStatusSchema = z.object({
  status_slug: z.string().min(1),
  comment: z.string().optional()
});

const assignPartsSchema = z.object({
  part_id: z.number().int().positive(),
  quantity: z.number().int().positive()
});

// recalcOrderCost и STATUS_TRANSITIONS импортируются из services/order.service.ts

// ============================================================
// GET /orders — список заказов с фильтрами и пагинацией
// ============================================================
ordersRouter.get('/', parsePagination(), async (req, res, next) => {
  try {
    const { limit, offset } = req.pagination;

    // Единое построение WHERE (см. lib/order-filters.ts)
    const { clause, params } = buildOrderWhere(
      {
        status: String(req.query.status ?? ''),
        master_id: String(req.query.master_id ?? ''),
        search: String(req.query.search ?? ''),
        overdue: String(req.query.overdue ?? ''),
        my: String(req.query.my ?? ''),
        group_id: String(req.query.group_id ?? ''),
        created_from: String(req.query.created_from ?? ''),
        created_to: String(req.query.created_to ?? ''),
        brand: String(req.query.brand ?? ''),
        model: String(req.query.model ?? ''),
        client_id: String(req.query.client_id ?? ''),
      },
      req.user?.userId,
    );
    const whereClause = clause ? `WHERE ${clause}` : '';

    const selectClause = `
      o.id, o.device_id, o.master_id, o.status_id,
      o.issue_description, o.diagnosis,
      o.cost, o.estimated_cost, o.prepaid, o.discount, o.internal_comment,
      o.deadline, o.status_deadline, o.priority, o.source,
      o.master_commission_pct, o.group_id, o.location_id,
      o.created_at, o.completed_at,
      o.password, o.face_id, o.completeness, o.condition, o.appearance, o.manager_notes, o.order_type,
      o.image_url,
      (o.deadline IS NOT NULL AND o.deadline < NOW() AND os.is_final = FALSE) AS is_overdue,
      os.name AS status_name, os.slug AS status_slug,
      d.brand, d.model, d.imei,
      c.id AS client_id, c.name AS client_name, c.phone AS client_phone, c.address AS client_address,
      u.name AS master_name, og.name AS group_name, l.name AS location_name,
      cu.name AS created_by_name`;

    const fromClause = `
      orders o
      JOIN order_statuses os ON os.id = o.status_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN users u ON u.id = o.master_id
      LEFT JOIN order_groups og ON og.id = o.group_id
      LEFT JOIN locations l ON l.id = o.location_id
      LEFT JOIN users cu ON cu.id = o.created_by`;

    // Основной запрос
    const sql = `SELECT ${selectClause} FROM ${fromClause} ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [result, countResult] = await Promise.all([
      pool.query(sql, [...params, limit, offset]),
      // COUNT: LEFT JOIN'ы и LATERAL не влияют на число строк — не тащим их
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orders o
         JOIN order_statuses os ON os.id = o.status_id
         JOIN devices d ON d.id = o.device_id
         JOIN clients c ON c.id = d.client_id
         ${whereClause}`,
        params,
      ),
    ]);

    res.json({
      orders: result.rows,
      total: countResult.rows[0].total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /orders/export — экспорт заказов в CSV
// ============================================================
ordersRouter.get('/export', requireRole('admin'), async (req, res, next) => {
  try {
    const { clause, params } = buildOrderWhere({
      status: String(req.query.status ?? ''),
      master_id: String(req.query.master_id ?? ''),
      search: String(req.query.search ?? ''),
      overdue: String(req.query.overdue ?? ''),
      group_id: String(req.query.group_id ?? ''),
    });

    let sql = `
      SELECT
        o.id, os.name AS status, o.priority,
        TO_CHAR(o.deadline, 'DD.MM.YYYY') AS deadline,
        c.name AS client, c.phone,
        d.brand || ' ' || d.model AS device, d.imei, d.serial_number,
        o.issue_description, o.cost, o.discount,
        (o.cost - o.discount) AS total,
        og.name AS "group",
        TO_CHAR(o.created_at, 'DD.MM.YYYY HH24:MI') AS created
      FROM orders o
      JOIN order_statuses os ON os.id = o.status_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN order_groups og ON og.id = o.group_id
    `;
    if (clause) sql += ` WHERE ${clause}`;

    sql += ' ORDER BY o.created_at DESC LIMIT 5000';
    const result = await pool.query(sql, params);

    // CSV: разделитель ; для Excel в русской локали
    const headers = ['№', 'Статус', 'Приоритет', 'Срок', 'Клиент', 'Телефон', 'Устройство', 'IMEI', 'Серийный номер', 'Проблема', 'Стоимость', 'Скидка', 'Итого', 'Группа', 'Создан'];
    const csvRows = [headers.join(';')];

    for (const row of result.rows) {
      csvRows.push([
        row.id,
        `"${(row.status || '').replace(/"/g, '""')}"`,
        row.priority === 'normal' ? '' : row.priority,
        row.deadline || '',
        `"${(row.client || '').replace(/"/g, '""')}"`,
        row.phone || '',
        `"${(row.device || '').replace(/"/g, '""')}"`,
        row.imei || '',
        row.serial_number || '',
        `"${(row.issue_description || '').replace(/"/g, '""')}"`,
        row.cost,
        row.discount,
        row.total,
        `"${(row.group || '').replace(/"/g, '""')}"`,
        row.created
      ].join(';'));
    }

    // BOM для Excel (UTF-8)
    const csv = '\uFEFF' + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /orders/:id — детали заказа
// ============================================================
ordersRouter.get('/:id([0-9]+)', async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);

    const orderResult = await pool.query(
      `SELECT
        o.id, o.device_id, o.master_id, o.status_id,
        o.issue_description, o.diagnosis, o.cost, o.estimated_cost,
        o.prepaid, o.discount, o.internal_comment,
        o.deadline, o.status_deadline, o.priority, o.source,
        o.master_commission_pct, o.group_id, o.location_id,
        o.created_at, o.completed_at,
        o.password, o.face_id, o.completeness, o.condition, o.appearance, o.manager_notes, o.order_type,
        o.image_url,
        os.name AS status_name, os.slug AS status_slug, os.is_final,
        d.brand, d.model, d.imei, d.serial_number, d.color,
        c.id AS client_id, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.address AS client_address,
        u.name AS master_name, og.name AS group_name, l.name AS location_name,
        cu.name AS created_by_name
      FROM orders o
      JOIN order_statuses os ON os.id = o.status_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN users u ON u.id = o.master_id
      LEFT JOIN order_groups og ON og.id = o.group_id
      LEFT JOIN locations l ON l.id = o.location_id
      LEFT JOIN users cu ON cu.id = o.created_by
      WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) throw new NotFoundError('Заказ');

    // История изменений
    const historyResult = await pool.query(
      `SELECT oh.*, u.name AS user_name,
        fs.name AS from_status_name, ts.name AS to_status_name
      FROM order_history oh
      LEFT JOIN users u ON u.id = oh.user_id
      LEFT JOIN order_statuses fs ON fs.id = oh.from_status_id
      JOIN order_statuses ts ON ts.id = oh.to_status_id
      WHERE oh.order_id = $1
      ORDER BY oh.created_at`,
      [id]
    );

    // Запчасти
    const partsResult = await pool.query(
      `SELECT op.*, p.name AS part_name, p.sku
      FROM order_parts op
      JOIN parts p ON p.id = op.part_id
      WHERE op.order_id = $1`,
      [id]
    );

    // Услуги
    const servicesResult = await pool.query(
      `SELECT osrv.*, s.name AS service_name
      FROM order_services osrv
      JOIN services s ON s.id = osrv.service_id
      WHERE osrv.order_id = $1`,
      [id]
    );

    // Платежи + их сплиты одним запросом (раньше — N+1: запрос на каждый платёж)
    const paymentsResult = await pool.query(
      `SELECT p.*, pm.name AS payment_method_name,
        COALESCE(
          (SELECT json_agg(json_build_object(
              'id', ps.id,
              'payment_id', ps.payment_id,
              'account_id', ps.account_id,
              'amount', ps.amount,
              'created_at', ps.created_at,
              'account_name', ca.name
            ) ORDER BY ps.id)
           FROM payment_splits ps
           JOIN company_accounts ca ON ca.id = ps.account_id
           WHERE ps.payment_id = p.id),
          '[]'::json
        ) AS splits
      FROM payments p
      JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.order_id = $1
      ORDER BY p.created_at`,
      [id]
    );

    res.json({
      ...orderResult.rows[0],
      history: historyResult.rows,
      parts: partsResult.rows,
      services: servicesResult.rows,
      payments: paymentsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /orders/:id/statuses — доступные статусы для перехода
// ============================================================
ordersRouter.get('/:id([0-9]+)/statuses', async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await pool.query(
      `SELECT os.slug FROM orders o
       JOIN order_statuses os ON os.id = o.status_id
       WHERE o.id = $1`,
      [id]
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');

    const currentSlug = order.rows[0].slug;
    const allowedSlugs = STATUS_TRANSITIONS[currentSlug] || [];

    if (allowedSlugs.length === 0) {
      return res.json({ current: currentSlug, available: [] });
    }

    // Возвращаем только допустимые статусы
    const placeholders = allowedSlugs.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `SELECT id, name, slug FROM order_statuses WHERE slug IN (${placeholders}) ORDER BY id`,
      [...allowedSlugs]
    );
    res.json({ current: currentSlug, available: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PATCH /orders/:id — обновление полей заказа (cost, diagnosis, etc)
// ============================================================
const updateOrderSchema = z.object({
  cost: z.number().nonnegative().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  diagnosis: z.string().optional(),
  issue_description: z.string().optional(),
  internal_comment: z.string().optional(),
  master_id: z.number().int().positive().optional(),
  master_commission_pct: z.number().min(0).max(100).optional(),
  deadline: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'critical']).optional(),
  source: z.string().optional(),
  group_id: z.number().int().positive().optional().nullable(),
  // Extended fields
  password: z.string().optional().or(z.literal('')),
  face_id: z.boolean().optional(),
  completeness: z.string().optional().or(z.literal('')),
  condition: z.string().optional().or(z.literal('')),
  appearance: z.string().optional().or(z.literal('')),
  manager_notes: z.string().optional().or(z.literal('')),
  order_type: z.enum(['paid', 'warranty']).optional(),
  image_url: z.string().optional().or(z.literal('')),
  // Client fields
  client_name: z.string().min(2).optional(),
  client_phone: z.string().min(5).optional(),
  // Device fields
  device_brand: z.string().min(1).optional(),
  device_model: z.string().min(1).optional(),
  device_imei: z.string().min(10).optional(),
  device_serial_number: z.string().optional().or(z.literal(''))
});

ordersRouter.patch('/:id([0-9]+)', requireRole('admin', 'master'), async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = updateOrderSchema.parse(req.body);

    // Все изменения (orders + devices + clients) — атомарно, одной транзакцией.
    // Раньше три UPDATE шли отдельными запросами: при ошибке на середине
    // данные рассинхронизировались.
    await withTransaction(async (dbClient) => {
      // Один SELECT вместо двух (было: проверка скидки + отдельно device_id)
      const orderRow = await dbClient.query(
        'SELECT cost, device_id FROM orders WHERE id = $1',
        [id]
      );
      if (orderRow.rows.length === 0) throw new NotFoundError('Заказ');
      const deviceId = orderRow.rows[0].device_id;

      // Валидация: скидка не может превышать стоимость
      if (input.discount !== undefined) {
        const currentCost = input.cost ?? Number(orderRow.rows[0].cost);
        if (input.discount > currentCost) {
          throw new BadRequestError('Скидка не может превышать стоимость заказа');
        }
      }

      // Обновление полей заказа
      const orderFields: string[] = [];
      const orderValues: unknown[] = [];
      let idx = 1;

      const orderFieldKeys = ['cost', 'estimated_cost', 'discount', 'diagnosis', 'issue_description',
        'internal_comment', 'master_id', 'master_commission_pct', 'deadline', 'priority', 'source', 'group_id',
        'password', 'face_id', 'completeness', 'condition', 'appearance', 'manager_notes', 'order_type',
        'image_url'];

      for (const key of orderFieldKeys) {
        const value = (input as Record<string, unknown>)[key];
        if (value !== undefined) {
          orderFields.push(`${key} = $${idx++}`);
          orderValues.push(value);
        }
      }

      // Обновление устройства
      const deviceFieldMap: Record<string, string> = {
        device_brand: 'brand',
        device_model: 'model',
        device_imei: 'imei',
        device_serial_number: 'serial_number'
      };
      const deviceFields: string[] = [];
      const deviceValues: unknown[] = [];

      for (const [inputKey, colName] of Object.entries(deviceFieldMap)) {
        const value = (input as Record<string, unknown>)[inputKey];
        if (value !== undefined) {
          deviceFields.push(`${colName} = $${deviceValues.length + 1}`);
          deviceValues.push(value);
        }
      }

      if (deviceFields.length > 0) {
        deviceValues.push(deviceId);
        await dbClient.query(
          `UPDATE devices SET ${deviceFields.join(', ')} WHERE id = $${deviceValues.length}`,
          deviceValues
        );
      }

      // Обновление клиента (через devices.client_id)
      const clientFieldMap: Record<string, string> = {
        client_name: 'name',
        client_phone: 'phone'
      };
      const clientFields: string[] = [];
      const clientValues: unknown[] = [];

      for (const [inputKey, colName] of Object.entries(clientFieldMap)) {
        const value = (input as Record<string, unknown>)[inputKey];
        if (value !== undefined) {
          clientFields.push(`${colName} = $${clientValues.length + 1}`);
          clientValues.push(value);
        }
      }

      if (clientFields.length > 0) {
        // Получаем client_id через device
        const dev = await dbClient.query('SELECT client_id FROM devices WHERE id = $1', [deviceId]);
        if (dev.rows.length > 0) {
          const clientId = dev.rows[0].client_id;
          clientValues.push(clientId);
          await dbClient.query(
            `UPDATE clients SET ${clientFields.join(', ')} WHERE id = $${clientValues.length}`,
            clientValues
          );
        }
      }

      // Если есть поля заказа — обновляем
      if (orderFields.length > 0) {
        orderValues.push(id);
        await dbClient.query(
          `UPDATE orders SET ${orderFields.join(', ')} WHERE id = $${idx}`,
          orderValues
        );
      }
    });

    // Возвращаем обновлённый заказ
    const result = await pool.query(`
      SELECT
        o.id, o.device_id, o.master_id, o.status_id,
        o.issue_description, o.diagnosis,
        o.cost, o.estimated_cost, o.prepaid, o.discount, o.internal_comment,
        o.deadline, o.status_deadline, o.priority, o.source,
        o.master_commission_pct, o.group_id,
        o.created_at, o.completed_at,
        os.name as status_name, os.slug as status_slug,
        d.brand, d.model, d.imei,
        c.id as client_id, c.name as client_name, c.phone as client_phone,
        u.name as master_name
      FROM orders o
      JOIN order_statuses os ON o.status_id = os.id
      JOIN devices d ON o.device_id = d.id
      JOIN clients c ON d.client_id = c.id
      LEFT JOIN users u ON o.master_id = u.id
      WHERE o.id = $1
    `, [id]);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /orders — создание заказа (делегировано сервису)
// ============================================================
ordersRouter.post('/', requireRole('admin', 'reception'), async (req, res, next) => {
  try {
    // Валидация — одна из двух схем
    if (req.body.device_id) {
      createOrderWithExistingDeviceSchema.parse(req.body);
    } else {
      createOrderWithNewDeviceSchema.parse(req.body);
    }

    const orderId = await createOrder(req.body, req.user!.userId);
    res.status(201).json({ id: orderId });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PATCH /orders/:id/status — смена статуса (делегировано сервису)
// ============================================================
ordersRouter.patch('/:id([0-9]+)/status', requireRole('admin', 'master'), async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const { status_slug, comment } = updateStatusSchema.parse(req.body);

    await updateOrderStatus(id, status_slug, req.user!.userId, comment);
    res.json({ message: 'Статус обновлён', status: status_slug });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /orders/:id/parts — списание запчасти на заказ (FIFO, делегировано сервису)
// ============================================================
ordersRouter.post('/:id([0-9]+)/parts', requireRole('admin', 'master'), async (req, res, next) => {
  try {
    const orderId = idParamSchema.parse(req.params.id);
    const { part_id, quantity } = assignPartsSchema.parse(req.body);

    const result = await assignPartToOrder(orderId, part_id, quantity);

    // Уведомления об остатках после списания (Блок 11 ТЗ)
    await checkStockAlerts(part_id);

    res.json({ message: 'Запчасть списана', ...result });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /orders/:id/parts/:opId — возврат запчасти на склад
// ============================================================
ordersRouter.delete('/:id([0-9]+)/parts/:opId([0-9]+)', requireRole('admin'), async (req, res, next) => {
  try {
    const orderId = idParamSchema.parse(req.params.id);
    const opId = idParamSchema.parse(req.params.opId);

    const result = await withTransaction(async (dbClient) => {
      const row = await dbClient.query(
        `SELECT op.id, op.part_id, op.quantity_used, op.batch_id, p.name
         FROM order_parts op JOIN parts p ON p.id = op.part_id
         WHERE op.id = $1 AND op.order_id = $2`,
        [opId, orderId]
      );
      if (row.rows.length === 0) throw new NotFoundError('Запчасть в заказе');

      const { part_id, quantity_used, batch_id, name } = row.rows[0];

      // Возвращаем остаток в ту же партию
      if (batch_id) {
        await dbClient.query(
          'UPDATE part_batches SET current_quantity = current_quantity + $1 WHERE id = $2',
          [quantity_used, batch_id]
        );
      } else {
        // Легаси-запись без партии: триггер не сработает — правим остаток вручную
        await dbClient.query('UPDATE parts SET quantity = quantity + $1 WHERE id = $2', [quantity_used, part_id]);
      }

      // Возвращаем остаток на локацию «Общий склад»
      await depositPartLocation(dbClient, part_id, null, quantity_used);

      // Удаляем из order_parts
      await dbClient.query('DELETE FROM order_parts WHERE id = $1', [opId]);

      // Запись в part_movements с типом return_order
      await dbClient.query(
        `INSERT INTO part_movements (part_id, type, quantity, order_id, batch_id)
         VALUES ($1, 'return_order', $2, $3, $4)`,
        [part_id, quantity_used, orderId, batch_id]
      );

      // Пересчитать стоимость заказа
      await recalcOrderCost(dbClient, orderId);

      return { name, quantity_used, orderId, part_id };
    });

    // Уведомление: возврат с заказа (Блок 11 ТЗ) — после COMMIT
    await createNotification('return_order', `Возврат с заказа: ${result.name}`, {
      part_id: result.part_id, part_name: result.name, quantity: result.quantity_used, order_id: result.orderId,
    });

    res.json({ message: `Запчасть "${result.name}" возвращена на склад`, quantity: result.quantity_used });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /orders/:id/reserve — зарезервировать запчасть под заказ
// ============================================================
ordersRouter.post('/:id([0-9]+)/reserve', requireRole('admin', 'master'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { part_id, quantity, batch_id, expires_at } = z.object({
      part_id: z.number().int().positive(),
      quantity: z.number().int().positive(),
      batch_id: z.number().int().positive().optional(),
      expires_at: z.string().datetime({ offset: true }).optional(),
    }).parse(req.body);

    const reservation = await withTransaction(async (dbClient) => {
      // Автопротухание истёкших резервов (expires_at < NOW())
      await dbClient.query(
        `UPDATE reservations SET status = 'cancelled'
         WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`
      );

      // Проверяем заказ
      const order = await dbClient.query(
        `SELECT o.id, os.is_final FROM orders o
         JOIN order_statuses os ON os.id = o.status_id WHERE o.id = $1`,
        [orderId]
      );
      if (order.rows.length === 0) throw new NotFoundError('Заказ');
      if (order.rows[0].is_final) {
        throw new BadRequestError('Нельзя резервировать в завершённом заказе');
      }

      // Проверяем остаток
      const part = await dbClient.query(
        'SELECT id, name, quantity FROM parts WHERE id = $1 FOR UPDATE', [part_id]
      );
      if (part.rows.length === 0) throw new NotFoundError('Запчасть');

      // Проверяем доступный остаток (с учётом активных резервов)
      const reserved = await dbClient.query(
        `SELECT COALESCE(SUM(quantity), 0)::int AS reserved
         FROM reservations WHERE part_id = $1 AND status = 'active'`,
        [part_id]
      );
      const available = part.rows[0].quantity - reserved.rows[0].reserved;
      if (available < quantity) {
        throw new BadRequestError(
          `Недостаточно для резерва. Доступно: ${available} (всего ${part.rows[0].quantity}, зарезервировано ${reserved.rows[0].reserved})`
        );
      }

      const result = await dbClient.query(
        `INSERT INTO reservations (part_id, batch_id, order_id, quantity, reserved_by, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW() + INTERVAL '7 days'), 'active') RETURNING *`,
        [part_id, batch_id || null, orderId, quantity, req.user!.userId, expires_at ?? null]
      );
      return result.rows[0];
    });

    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /orders/:id/reservations — список резервов по заказу
// ============================================================
ordersRouter.get('/:id([0-9]+)/reservations', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const result = await pool.query(
      `SELECT r.*, p.name AS part_name, p.sku,
        pb.batch_number, u.name AS reserved_by_name,
        (r.status = 'active' AND r.expires_at IS NOT NULL AND r.expires_at < NOW()) AS is_expired
       FROM reservations r
       JOIN parts p ON p.id = r.part_id
       LEFT JOIN part_batches pb ON pb.id = r.batch_id
       JOIN users u ON u.id = r.reserved_by
       WHERE r.order_id = $1
       ORDER BY r.reserved_at DESC`,
      [orderId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /orders/:id/reserve/:reservationId — отменить резерв
// ============================================================
ordersRouter.delete('/:id([0-9]+)/reserve/:reservationId([0-9]+)', requireRole('admin'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const reservationId = parseInt(req.params.reservationId);

    const result = await pool.query(
      `UPDATE reservations SET status = 'cancelled'
       WHERE id = $1 AND order_id = $2 AND status = 'active' RETURNING *`,
      [reservationId, orderId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Активный резерв');

    res.json({ message: 'Резерв отменён', reservation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /orders/:id/services — добавить услугу к заказу
// ============================================================
ordersRouter.post('/:id([0-9]+)/services', requireRole('admin', 'master', 'reception'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { service_id, quantity } = z.object({
      service_id: z.number().int().positive(),
      quantity: z.number().int().positive().default(1)
    }).parse(req.body);

    // Атомарно: проверка → вставка → пересчёт стоимости
    const created = await withTransaction(async (dbClient) => {
      // Проверить заказ
      const order = await dbClient.query(
        `SELECT o.id, os.is_final FROM orders o
         JOIN order_statuses os ON os.id = o.status_id WHERE o.id = $1`,
        [orderId]
      );
      if (order.rows.length === 0) throw new NotFoundError('Заказ');
      if (order.rows[0].is_final) throw new BadRequestError('Нельзя добавить услугу в завершённый заказ');

      // Найти услугу
      const svc = await dbClient.query('SELECT * FROM services WHERE id = $1', [service_id]);
      if (svc.rows.length === 0) throw new NotFoundError('Услуга');

      const { price, master_commission_pct } = svc.rows[0];

      const result = await dbClient.query(
        `INSERT INTO order_services (order_id, service_id, quantity, price_at_moment, master_commission_pct_at_moment)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [orderId, service_id, quantity, price, master_commission_pct]
      );

      // Пересчитать стоимость заказа
      await recalcOrderCost(dbClient, orderId);

      return result.rows[0];
    });

    res.status(201).json(created);
  } catch (error) { next(error); }
});

// ============================================================
// DELETE /orders/:id/services/:sid — убрать услугу из заказа
// ============================================================
ordersRouter.delete('/:id([0-9]+)/services/:sid([0-9]+)', requireRole('admin', 'master', 'reception'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const serviceId = parseInt(req.params.sid);

    const removedName = await withTransaction(async (dbClient) => {
      const row = await dbClient.query(
        'SELECT osrv.quantity, s.name FROM order_services osrv JOIN services s ON s.id = osrv.service_id WHERE osrv.order_id = $1 AND osrv.service_id = $2',
        [orderId, serviceId]
      );
      if (row.rows.length === 0) throw new NotFoundError('Услуга в заказе');

      await dbClient.query('DELETE FROM order_services WHERE order_id = $1 AND service_id = $2', [orderId, serviceId]);

      // Пересчитать стоимость заказа
      await recalcOrderCost(dbClient, orderId);

      return row.rows[0].name;
    });

    res.json({ message: `Услуга "${removedName}" убрана из заказа` });
  } catch (error) { next(error); }
});
