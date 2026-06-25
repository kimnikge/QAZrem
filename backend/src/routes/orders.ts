import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { idParamSchema } from '../lib/validation.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTelegramMessage } from '../services/telegram.js';

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

const createOrderWithNewDeviceSchema = z.object({
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
  }),
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
});

const createOrderWithExistingDeviceSchema = z.object({
  device_id: z.number().int().positive(),
  issue_description: z.string().min(5),
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
});

const updateStatusSchema = z.object({
  status_slug: z.string().min(1),
  comment: z.string().optional()
});

const assignPartsSchema = z.object({
  part_id: z.number().int().positive(),
  quantity: z.number().int().positive()
});

// Пересчёт стоимости заказа на основе запчастей и услуг
async function recalcOrderCost(client: import('pg').PoolClient | typeof pool, orderId: number): Promise<void> {
  const result = await client.query(
    `SELECT
      COALESCE((SELECT SUM(op.selling_price_at_moment * op.quantity_used) FROM order_parts op WHERE op.order_id = $1), 0) +
      COALESCE((SELECT SUM(osrv.price_at_moment * osrv.quantity) FROM order_services osrv WHERE osrv.order_id = $1), 0) AS total`,
    [orderId]
  );
  const cost = Math.round(Number(result.rows[0].total));
  await client.query('UPDATE orders SET cost = $1 WHERE id = $2', [cost, orderId]);
}

// Допустимые переходы статусов
const STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['diagnosis', 'cancelled'],
  diagnosis: ['waiting_parts', 'repair', 'ready', 'cancelled'],
  waiting_parts: ['repair', 'cancelled'],
  repair: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

// ============================================================
// GET /orders — список заказов с фильтрами и пагинацией
// ============================================================
ordersRouter.get('/', async (req, res, next) => {
  try {
    const { status, master_id, search, overdue, my, group_id,
      created_from, created_to, brand, model, client_id,
      limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const offsetNum = Math.max(parseInt(offset as string, 10) || 0, 0);

    let sql = `
      SELECT
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
        cu.name AS created_by_name
      FROM orders o
      JOIN order_statuses os ON os.id = o.status_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN users u ON u.id = o.master_id
      LEFT JOIN order_groups og ON og.id = o.group_id
      LEFT JOIN locations l ON l.id = o.location_id
      LEFT JOIN LATERAL (
        SELECT uh.user_id, us.name
        FROM order_history uh
        LEFT JOIN users us ON us.id = uh.user_id
        WHERE uh.order_id = o.id AND uh.from_status_id IS NULL
        ORDER BY uh.created_at LIMIT 1
      ) cu ON true
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      sql += ` AND os.slug = $${idx++}`;
      params.push(status);
    }
    if (master_id) {
      sql += ` AND o.master_id = $${idx++}`;
      params.push(Number(master_id));
    }
    if (search) {
      sql += ` AND (c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR d.imei ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (overdue === 'true') {
      sql += ` AND o.deadline IS NOT NULL AND o.deadline < NOW() AND os.is_final = FALSE`;
    }
    if (my === 'true' && req.user?.userId) {
      sql += ` AND o.master_id = $${idx++}`;
      params.push(req.user.userId);
    }
    if (group_id) {
      if (group_id === 'null') {
        sql += ' AND o.group_id IS NULL';
      } else {
        sql += ` AND o.group_id = $${idx++}`;
        params.push(Number(group_id));
      }
    }
    if (created_from) {
      sql += ` AND o.created_at >= $${idx++}`;
      params.push(created_from);
    }
    if (created_to) {
      sql += ` AND o.created_at <= $${idx++}`;
      params.push(created_to);
    }
    if (brand) {
      sql += ` AND d.brand ILIKE $${idx++}`;
      params.push(`%${brand}%`);
    }
    if (model) {
      sql += ` AND d.model ILIKE $${idx++}`;
      params.push(`%${model}%`);
    }
    if (client_id) {
      sql += ` AND c.id = $${idx++}`;
      params.push(Number(client_id));
    }

    // Общее количество (для пагинации)
    const countSql = sql.replace(
      /SELECT[\s\S]*?FROM/,
      'SELECT COUNT(*)::int AS total FROM'
    );
    const countResult = await pool.query(countSql, params);

    sql += ' ORDER BY o.created_at DESC';
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offsetNum);

    const result = await pool.query(sql, params);
    res.json({
      orders: result.rows,
      total: countResult.rows[0].total,
      limit: limitNum,
      offset: offsetNum
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
    const { status, master_id, search, overdue, group_id } = req.query;

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
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (status) { sql += ` AND os.slug = $${idx++}`; params.push(status); }
    if (master_id) { sql += ` AND o.master_id = $${idx++}`; params.push(Number(master_id)); }
    if (search) {
      sql += ` AND (c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR d.imei ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (overdue === 'true') {
      sql += ` AND o.deadline IS NOT NULL AND o.deadline < NOW() AND os.is_final = FALSE`;
    }
    if (group_id) {
      if (group_id === 'null') sql += ' AND o.group_id IS NULL';
      else { sql += ` AND o.group_id = $${idx++}`; params.push(Number(group_id)); }
    }

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
ordersRouter.get('/:id', async (req, res, next) => {
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
      LEFT JOIN LATERAL (
        SELECT us.name FROM order_history uh
        LEFT JOIN users us ON us.id = uh.user_id
        WHERE uh.order_id = o.id AND uh.from_status_id IS NULL
        ORDER BY uh.created_at LIMIT 1
      ) cu ON true
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

    // Платежи
    const paymentsResult = await pool.query(
      `SELECT p.*, pm.name AS payment_method_name
      FROM payments p
      JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.order_id = $1
      ORDER BY p.created_at`,
      [id]
    );

    // Splits для каждого платежа
    const paymentsWithSplits = [];
    for (const payment of paymentsResult.rows) {
      const splitsResult = await pool.query(
        `SELECT ps.*, ca.name AS account_name
        FROM payment_splits ps
        JOIN company_accounts ca ON ca.id = ps.account_id
        WHERE ps.payment_id = $1`,
        [payment.id]
      );
      paymentsWithSplits.push({ ...payment, splits: splitsResult.rows });
    }

    res.json({
      ...orderResult.rows[0],
      history: historyResult.rows,
      parts: partsResult.rows,
      services: servicesResult.rows,
      payments: paymentsWithSplits
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /orders/:id/statuses — доступные статусы для перехода
// ============================================================
ordersRouter.get('/:id/statuses', async (req, res, next) => {
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
      allowedSlugs
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

ordersRouter.patch('/:id', requireRole('admin', 'master'), async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = updateOrderSchema.parse(req.body);

    // Валидация: скидка не может превышать стоимость
    if (input.discount !== undefined) {
      const currentOrder = await pool.query(
        'SELECT cost, device_id FROM orders WHERE id = $1',
        [id]
      );
      if (currentOrder.rows.length === 0) throw new NotFoundError('Заказ');
      const currentCost = input.cost ?? Number(currentOrder.rows[0].cost);
      if (input.discount > currentCost) {
        throw new BadRequestError('Скидка не может превышать стоимость заказа');
      }
    }

    // Получаем текущий заказ для device_id (нужен для обновления устройства)
    const orderRow = await pool.query(
      'SELECT device_id FROM orders WHERE id = $1',
      [id]
    );
    if (orderRow.rows.length === 0) throw new NotFoundError('Заказ');
    const deviceId = orderRow.rows[0].device_id;

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
      await pool.query(
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
      const dev = await pool.query('SELECT client_id FROM devices WHERE id = $1', [deviceId]);
      if (dev.rows.length > 0) {
        const clientId = dev.rows[0].client_id;
        clientValues.push(clientId);
        await pool.query(
          `UPDATE clients SET ${clientFields.join(', ')} WHERE id = $${clientValues.length}`,
          clientValues
        );
      }
    }

    // Если есть поля заказа — обновляем
    if (orderFields.length > 0) {
      orderValues.push(id);
      await pool.query(
        `UPDATE orders SET ${orderFields.join(', ')} WHERE id = $${idx}`,
        orderValues
      );
    }

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
// POST /orders — создание заказа
// ============================================================
ordersRouter.post('/', requireRole('admin', 'reception'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let deviceId: number;

    // Сценарий A: передан существующий device_id
    if (req.body.device_id) {
      const input = createOrderWithExistingDeviceSchema.parse(req.body);

      // Валидация: скидка не может превышать стоимость
      if (input.discount !== undefined && input.estimated_cost !== undefined && input.discount > input.estimated_cost) {
        throw new BadRequestError('Скидка не может превышать стоимость заказа');
      }

      const device = await client.query('SELECT id, client_id, brand, model FROM devices WHERE id = $1', [input.device_id]);
      if (device.rows.length === 0) throw new NotFoundError('Устройство');
      deviceId = device.rows[0].id;

      // Автодобавление в каталог
      await client.query(
        `INSERT INTO device_catalog (brand, model)
         VALUES ($1, $2)
         ON CONFLICT (brand, model) DO NOTHING`,
        [device.rows[0].brand, device.rows[0].model]
      );
    }
    // Сценарий B: новый клиент + новое устройство
    else {
      const input = createOrderWithNewDeviceSchema.parse(req.body);

      // Валидация: скидка не может превышать стоимость
      if (input.discount !== undefined && input.estimated_cost !== undefined && input.discount > input.estimated_cost) {
        throw new BadRequestError('Скидка не может превышать стоимость заказа');
      }

      // Ищем клиента по телефону
      let clientResult = await client.query(
        'SELECT id FROM clients WHERE phone = $1',
        [input.client.phone]
      );

      let clientId: number;
      if (clientResult.rows.length > 0) {
        clientId = clientResult.rows[0].id;
      } else {
        // Создаём нового клиента
        clientResult = await client.query(
          `INSERT INTO clients (name, phone, email, address)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [input.client.name, input.client.phone, input.client.email || null, input.client.address || null]
        );
        clientId = clientResult.rows[0].id;
      }

      // Создаём устройство
      const deviceResult = await client.query(
        `INSERT INTO devices (client_id, brand, model, imei, serial_number, color)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          clientId,
          input.device.brand,
          input.device.model,
          input.device.imei,
          input.device.serial_number || null,
          input.device.color || null
        ]
      );
      deviceId = deviceResult.rows[0].id;

      // Автодобавление в каталог
      await client.query(
        `INSERT INTO device_catalog (brand, model)
         VALUES ($1, $2)
         ON CONFLICT (brand, model) DO NOTHING`,
        [input.device.brand, input.device.model]
      );
    }

    // Получаем ID статуса "new"
    const statusResult = await client.query(
      "SELECT id FROM order_statuses WHERE slug = 'new'"
    );
    const newStatusId = statusResult.rows[0].id;

    const masterId = req.body.master_id || null;

    // Определяем процент комиссии мастера
    let masterCommissionPct = req.body.master_commission_pct;
    if (masterCommissionPct === undefined && masterId) {
      const masterUser = await client.query(
        'SELECT default_commission_pct FROM users WHERE id = $1',
        [masterId]
      );
      masterCommissionPct = masterUser.rows.length > 0
        ? Number(masterUser.rows[0].default_commission_pct)
        : 50;
    }
    if (masterCommissionPct === undefined) masterCommissionPct = 50;

    // Создаём заказ
    const orderResult = await client.query(
      `INSERT INTO orders (device_id, master_id, status_id, issue_description, deadline, priority, source, estimated_cost, discount, master_commission_pct, group_id, location_id, password, face_id, completeness, condition, appearance, manager_notes, order_type, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id`,
      [
        deviceId,
        masterId,
        newStatusId,
        req.body.issue_description,
        req.body.deadline || null,
        req.body.priority || 'normal',
        req.body.source || null,
        req.body.estimated_cost || 0,
        req.body.discount || 0,
        masterCommissionPct,
        req.body.group_id || null,
        req.body.location_id || null,
        req.body.password || null,
        req.body.face_id || false,
        req.body.completeness || null,
        req.body.condition || null,
        req.body.appearance || null,
        req.body.manager_notes || null,
        req.body.order_type || 'paid',
        req.body.image_url || null
      ]
    );
    const orderId = orderResult.rows[0].id;

    // Запись в history
    await client.query(
      `INSERT INTO order_history (order_id, user_id, from_status_id, to_status_id, comment)
       VALUES ($1, $2, NULL, $3, 'Создан заказ')`,
      [orderId, req.user!.userId, newStatusId]
    );

    // Списание запчастей (если переданы) — FIFO
    const parts: Array<{ part_id: number; quantity: number }> = req.body.parts || [];
    for (const part of parts) {
      // Проверяем остаток
      const stockResult = await client.query(
        'SELECT id, quantity, selling_price FROM parts WHERE id = $1 FOR UPDATE',
        [part.part_id]
      );
      if (stockResult.rows.length === 0) {
        throw new NotFoundError(`Запчасть с id=${part.part_id}`);
      }
      if (stockResult.rows[0].quantity < part.quantity) {
        throw new BadRequestError(
          `Недостаточно запчасти #${part.part_id} на складе (остаток: ${stockResult.rows[0].quantity}, требуется: ${part.quantity})`
        );
      }

      const sellingPrice = Number(stockResult.rows[0].selling_price);

      // FIFO: списываем из партий
      const batches = await client.query(
        `SELECT id, batch_number, current_quantity, purchase_price
         FROM part_batches WHERE part_id = $1 AND current_quantity > 0
         ORDER BY received_at ASC FOR UPDATE`,
        [part.part_id]
      );

      let remaining = part.quantity;
      for (const batch of batches.rows) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.current_quantity);
        remaining -= take;

        await client.query(
          'UPDATE part_batches SET current_quantity = current_quantity - $1 WHERE id = $2',
          [take, batch.id]
        );

        // Запись в order_parts с batch_id
        await client.query(
          `INSERT INTO order_parts (order_id, part_id, quantity_used, purchase_price_at_moment, selling_price_at_moment, batch_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, part.part_id, take, batch.purchase_price, sellingPrice, batch.id]
        );

        // Запись в part_movements
        await client.query(
          `INSERT INTO part_movements (part_id, type, quantity, order_id, batch_id, batch_number)
           VALUES ($1, 'outgoing', $2, $3, $4, $5)`,
          [part.part_id, take, orderId, batch.id, batch.batch_number]
        );
      }

      // Проверяем, что весь объём покрыт партиями
      if (remaining > 0) {
        throw new BadRequestError(
          `Несоответствие остатков по запчасти #${part.part_id}: не хватает ${remaining}шт в партиях`
        );
      }

      // Уменьшаем общий остаток
      await client.query(
        'UPDATE parts SET quantity = quantity - $1 WHERE id = $2',
        [part.quantity, part.part_id]
      );
    }

    // Добавление услуг (если переданы)
    const services: Array<{ service_id: number; quantity: number }> = req.body.services || [];
    for (const svc of services) {
      const svcResult = await client.query(
        'SELECT price, master_commission_pct FROM services WHERE id = $1',
        [svc.service_id]
      );
      if (svcResult.rows.length === 0) {
        throw new NotFoundError(`Услуга с id=${svc.service_id}`);
      }
      await client.query(
        `INSERT INTO order_services (order_id, service_id, quantity, price_at_moment, master_commission_pct_at_moment)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, svc.service_id, svc.quantity || 1, Number(svcResult.rows[0].price), Number(svcResult.rows[0].master_commission_pct)]
      );
    }

    await client.query('COMMIT');

    // Уведомление в Telegram
    const fullOrder = await pool.query(
      `SELECT o.id, c.name AS client_name, c.phone, d.brand, d.model, o.issue_description
       FROM orders o
       JOIN devices d ON d.id = o.device_id
       JOIN clients c ON c.id = d.client_id
       WHERE o.id = $1`,
      [orderId]
    );

    const o = fullOrder.rows[0];
    // Уведомление в Telegram (не блокирует создание заказа)
    try {
      await sendTelegramMessage(
        [
          '<b>🆕 Новый заказ</b>',
          `№${o.id} | ${o.brand} ${o.model}`,
          `Клиент: ${o.client_name} (${o.phone})`,
          `Проблема: ${o.issue_description}`
        ].join('\n')
      );
    } catch (tgError) {
      console.error('Telegram notification failed:', tgError instanceof Error ? tgError.message : tgError);
    }

    res.status(201).json({ id: orderId });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================================
// PATCH /orders/:id/status — смена статуса
// ============================================================
ordersRouter.patch('/:id/status', requireRole('admin', 'master'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const input = updateStatusSchema.parse(req.body);

    await dbClient.query('BEGIN');

    // Получаем текущий статус заказа
    const order = await dbClient.query(
      'SELECT o.status_id, o.cost, o.discount, os.slug AS current_slug, os.is_final FROM orders o JOIN order_statuses os ON os.id = o.status_id WHERE o.id = $1',
      [id]
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');

    const { current_slug, is_final, cost, discount } = order.rows[0];

    if (is_final) {
      throw new BadRequestError('Нельзя изменить статус финального заказа');
    }

    // Проверяем допустимость перехода
    const allowedSlugs = STATUS_TRANSITIONS[current_slug] || [];
    if (!allowedSlugs.includes(input.status_slug)) {
      throw new BadRequestError(`Нельзя перевести заказ из статуса «${current_slug}» в «${input.status_slug}»`);
    }

    // Получаем ID нового статуса
    const newStatus = await dbClient.query(
      'SELECT id, is_final FROM order_statuses WHERE slug = $1',
      [input.status_slug]
    );
    if (newStatus.rows.length === 0) throw new NotFoundError('Статус');

    const newStatusId = newStatus.rows[0].id;
    const newIsFinal = newStatus.rows[0].is_final;

    // При переходе в completed проверяем, что заказ полностью оплачен
    if (input.status_slug === 'completed') {
      const paymentSum = await dbClient.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE order_id = $1`,
        [id]
      );
      const totalPaid = Math.round(Number(paymentSum.rows[0].total_paid));
      const totalCost = Math.round(Number(cost)) - Math.round(Number(discount));
      if (totalPaid < totalCost) {
        throw new BadRequestError(`Нельзя выдать заказ: не полностью оплачен (оплачено ${totalPaid} из ${totalCost} ₸)`);
      }
    }

    // Обновляем статус
    let updateSql = 'UPDATE orders SET status_id = $1';
    const updateParams: unknown[] = [newStatusId];
    let idx = 2;

    if (newIsFinal && input.status_slug === 'completed') {
      updateSql += `, completed_at = NOW()`;
    }

    updateSql += ` WHERE id = $${idx} RETURNING id`;
    updateParams.push(id);

    await dbClient.query(updateSql, updateParams);

    // Запись в history
    await dbClient.query(
      `INSERT INTO order_history (order_id, user_id, from_status_id, to_status_id, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user!.userId, order.rows[0].status_id, newStatusId, input.comment || null]
    );

    await dbClient.query('COMMIT');

    res.json({ message: 'Статус обновлён', status: input.status_slug });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// ============================================================
// POST /orders/:id/parts — списание запчасти на заказ (FIFO)
// ============================================================
ordersRouter.post('/:id/parts', requireRole('admin', 'master'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const input = assignPartsSchema.parse(req.body);

    await dbClient.query('BEGIN');

    // Проверяем заказ
    const order = await dbClient.query(
      `SELECT o.id, os.is_final FROM orders o
       JOIN order_statuses os ON os.id = o.status_id
       WHERE o.id = $1`,
      [id]
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');
    if (order.rows[0].is_final) {
      throw new BadRequestError('Нельзя списать запчасть на завершённый заказ');
    }

    // Проверяем остаток
    const part = await dbClient.query(
      'SELECT id, name, selling_price, quantity FROM parts WHERE id = $1 FOR UPDATE',
      [input.part_id]
    );
    if (part.rows.length === 0) throw new NotFoundError('Запчасть');

    const { name, selling_price, quantity } = part.rows[0];

    if (quantity < input.quantity) {
      throw new BadRequestError(
        `Недостаточно запчастей "${name}". Доступно: ${quantity}, требуется: ${input.quantity}`
      );
    }

    // FIFO: списываем из партий
    const batches = await dbClient.query(
      `SELECT id, batch_number, current_quantity, purchase_price
       FROM part_batches WHERE part_id = $1 AND current_quantity > 0
       ORDER BY received_at ASC FOR UPDATE`,
      [input.part_id]
    );

    let remaining = input.quantity;
    for (const batch of batches.rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.current_quantity);
      remaining -= take;

      await dbClient.query(
        'UPDATE part_batches SET current_quantity = current_quantity - $1 WHERE id = $2',
        [take, batch.id]
      );

      // Запись в order_parts с batch_id
      await dbClient.query(
        `INSERT INTO order_parts (order_id, part_id, quantity_used, purchase_price_at_moment, selling_price_at_moment, batch_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, input.part_id, take, batch.purchase_price, selling_price, batch.id]
      );

      // Запись в part_movements
      await dbClient.query(
        `INSERT INTO part_movements (part_id, type, quantity, order_id, batch_id, batch_number)
         VALUES ($1, 'outgoing', $2, $3, $4, $5)`,
        [input.part_id, take, id, batch.id, batch.batch_number]
      );
    }

    // Проверяем, что весь объём покрыт партиями
    if (remaining > 0) {
      throw new BadRequestError(
        `Несоответствие остатков: не хватает ${remaining}шт в партиях`
      );
    }

    // Уменьшаем общий остаток
    await dbClient.query(
      'UPDATE parts SET quantity = quantity - $1 WHERE id = $2',
      [input.quantity, input.part_id]
    );

    // Пересчитать стоимость заказа
    await recalcOrderCost(dbClient, Number(id));

    await dbClient.query('COMMIT');
    res.json({ message: 'Запчасть списана', part_name: name, quantity: input.quantity });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// ============================================================
// DELETE /orders/:id/parts/:opId — возврат запчасти на склад
// ============================================================
ordersRouter.delete('/:id/parts/:opId', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const orderId = idParamSchema.parse(req.params.id);
    const opId = idParamSchema.parse(req.params.opId);

    await dbClient.query('BEGIN');

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
    }

    // Возвращаем на склад
    await dbClient.query('UPDATE parts SET quantity = quantity + $1 WHERE id = $2', [quantity_used, part_id]);

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

    await dbClient.query('COMMIT');
    res.json({ message: `Запчасть "${name}" возвращена на склад`, quantity: quantity_used });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// ============================================================
// POST /orders/:id/reserve — зарезервировать запчасть под заказ
// ============================================================
ordersRouter.post('/:id/reserve', requireRole('admin', 'master'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const orderId = parseInt(req.params.id);
    const { part_id, quantity, batch_id } = z.object({
      part_id: z.number().int().positive(),
      quantity: z.number().int().positive(),
      batch_id: z.number().int().positive().optional(),
    }).parse(req.body);

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
      `INSERT INTO reservations (part_id, batch_id, order_id, quantity, reserved_by, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [part_id, batch_id || null, orderId, quantity, req.user!.userId]
    );

    await dbClient.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});

// ============================================================
// GET /orders/:id/reservations — список резервов по заказу
// ============================================================
ordersRouter.get('/:id/reservations', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const result = await pool.query(
      `SELECT r.*, p.name AS part_name, p.sku,
        pb.batch_number, u.name AS reserved_by_name
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
ordersRouter.delete('/:id/reserve/:reservationId', requireRole('admin'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const orderId = parseInt(req.params.id);
    const reservationId = parseInt(req.params.reservationId);

    const result = await dbClient.query(
      `UPDATE reservations SET status = 'cancelled'
       WHERE id = $1 AND order_id = $2 AND status = 'active' RETURNING *`,
      [reservationId, orderId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Активный резерв');

    res.json({ message: 'Резерв отменён', reservation: result.rows[0] });
  } catch (error) {
    next(error);
  } finally {
    dbClient.release();
  }
});

// ============================================================
// POST /orders/:id/services — добавить услугу к заказу
// ============================================================
ordersRouter.post('/:id/services', requireRole('admin', 'master', 'reception'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { service_id, quantity } = z.object({
      service_id: z.number().int().positive(),
      quantity: z.number().int().positive().default(1)
    }).parse(req.body);

    // Проверить заказ
    const order = await pool.query(
      `SELECT o.id, os.is_final FROM orders o
       JOIN order_statuses os ON os.id = o.status_id WHERE o.id = $1`,
      [orderId]
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');
    if (order.rows[0].is_final) throw new BadRequestError('Нельзя добавить услугу в завершённый заказ');

    // Найти услугу
    const svc = await pool.query('SELECT * FROM services WHERE id = $1', [service_id]);
    if (svc.rows.length === 0) throw new NotFoundError('Услуга');

    const { price, master_commission_pct } = svc.rows[0];

    const result = await pool.query(
      `INSERT INTO order_services (order_id, service_id, quantity, price_at_moment, master_commission_pct_at_moment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orderId, service_id, quantity, price, master_commission_pct]
    );

    // Пересчитать стоимость заказа
    await recalcOrderCost(pool, orderId);

    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

// ============================================================
// DELETE /orders/:id/services/:sid — убрать услугу из заказа
// ============================================================
ordersRouter.delete('/:id/services/:sid', requireRole('admin', 'master', 'reception'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const serviceId = parseInt(req.params.sid);

    const row = await pool.query(
      'SELECT osrv.quantity, s.name FROM order_services osrv JOIN services s ON s.id = osrv.service_id WHERE osrv.order_id = $1 AND osrv.service_id = $2',
      [orderId, serviceId]
    );
    if (row.rows.length === 0) throw new NotFoundError('Услуга в заказе');

    await pool.query('DELETE FROM order_services WHERE order_id = $1 AND service_id = $2', [orderId, serviceId]);

    // Пересчитать стоимость заказа
    await recalcOrderCost(pool, orderId);

    res.json({ message: `Услуга "${row.rows[0].name}" убрана из заказа` });
  } catch (error) { next(error); }
});
