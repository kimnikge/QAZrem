import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTelegramMessage } from '../services/telegram.js';

export const ordersRouter = Router();

// Все роуты заказов требуют авторизации
ordersRouter.use(requireAuth);

// ============================================================
// Схемы валидации
// ============================================================

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
  source: z.string().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional()
});

const createOrderWithExistingDeviceSchema = z.object({
  device_id: z.number().int().positive(),
  issue_description: z.string().min(5),
  master_id: z.number().int().positive().optional(),
  master_commission_pct: z.number().min(0).max(100).optional(),
  deadline: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'critical']).optional(),
  source: z.string().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional()
});

const updateStatusSchema = z.object({
  status_slug: z.string().min(1),
  comment: z.string().optional()
});

const assignPartsSchema = z.object({
  part_id: z.number().int().positive(),
  quantity: z.number().int().positive()
});

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
    const { status, master_id, search, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const offsetNum = Math.max(parseInt(offset as string, 10) || 0, 0);

    let sql = `
      SELECT
        o.id, o.device_id, o.master_id, o.status_id,
        o.issue_description, o.diagnosis,
        o.cost, o.estimated_cost, o.prepaid, o.discount, o.internal_comment,
        o.deadline, o.status_deadline, o.priority, o.source,
        o.master_commission_pct,
        o.created_at, o.completed_at,
        os.name AS status_name, os.slug AS status_slug,
        d.brand, d.model, d.imei,
        c.id AS client_id, c.name AS client_name, c.phone AS client_phone, c.address AS client_address,
        u.name AS master_name
      FROM orders o
      JOIN order_statuses os ON os.id = o.status_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN users u ON u.id = o.master_id
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
// GET /orders/:id — детали заказа
// ============================================================
ordersRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `SELECT
        o.id, o.device_id, o.master_id, o.status_id,
        o.issue_description, o.diagnosis, o.cost, o.estimated_cost,
        o.prepaid, o.discount, o.internal_comment,
        o.deadline, o.status_deadline, o.priority, o.source,
        o.master_commission_pct,
        o.created_at, o.completed_at,
        os.name AS status_name, os.slug AS status_slug, os.is_final,
        d.brand, d.model, d.imei, d.serial_number, d.color,
        c.id AS client_id, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.address AS client_address,
        u.name AS master_name
      FROM orders o
      JOIN order_statuses os ON os.id = o.status_id
      JOIN devices d ON d.id = o.device_id
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN users u ON u.id = o.master_id
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

    // Платежи
    const paymentsResult = await pool.query(
      `SELECT p.*, pm.name AS payment_method_name
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
      payments: paymentsResult.rows
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
    const available = STATUS_TRANSITIONS[currentSlug] || [];
    const result = await pool.query(
      `SELECT id, name, slug FROM order_statuses WHERE slug = ANY($1)`,
      [available]
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
  internal_comment: z.string().optional(),
  master_id: z.number().int().positive().optional(),
  master_commission_pct: z.number().min(0).max(100).optional(),
  deadline: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'critical']).optional(),
  source: z.string().optional()
});

ordersRouter.patch('/:id', requireRole('admin', 'master'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = updateOrderSchema.parse(req.body);

    // Валидация: скидка не может превышать стоимость
    if (input.discount !== undefined) {
      const currentOrder = await pool.query(
        'SELECT cost FROM orders WHERE id = $1',
        [id]
      );
      if (currentOrder.rows.length === 0) throw new NotFoundError('Заказ');
      const currentCost = input.cost ?? Number(currentOrder.rows[0].cost);
      if (input.discount > currentCost) {
        throw new BadRequestError('Скидка не может превышать стоимость заказа');
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      res.json({ message: 'Нет полей для обновления' });
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, device_id, master_id, status_id, issue_description, diagnosis, cost, prepaid, internal_comment, created_at, completed_at`,
      values
    );

    if (result.rows.length === 0) throw new NotFoundError('Заказ');
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

      const device = await client.query('SELECT id, client_id FROM devices WHERE id = $1', [input.device_id]);
      if (device.rows.length === 0) throw new NotFoundError('Устройство');
      deviceId = device.rows[0].id;
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
      `INSERT INTO orders (device_id, master_id, status_id, issue_description, deadline, priority, source, estimated_cost, discount, master_commission_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        masterCommissionPct
      ]
    );
    const orderId = orderResult.rows[0].id;

    // Запись в history
    await client.query(
      `INSERT INTO order_history (order_id, user_id, from_status_id, to_status_id, comment)
       VALUES ($1, $2, NULL, $3, 'Создан заказ')`,
      [orderId, req.user!.userId, newStatusId]
    );

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
    await sendTelegramMessage(
      [
        '<b>🆕 Новый заказ</b>',
        `№${o.id} | ${o.brand} ${o.model}`,
        `Клиент: ${o.client_name} (${o.phone})`,
        `Проблема: ${o.issue_description}`
      ].join('\n')
    );

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
      'SELECT o.status_id, os.slug AS current_slug, os.is_final FROM orders o JOIN order_statuses os ON os.id = o.status_id WHERE o.id = $1',
      [id]
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');

    const { current_slug, is_final } = order.rows[0];

    if (is_final) {
      throw new BadRequestError('Нельзя изменить статус финального заказа');
    }

    // Проверяем допустимость перехода
    const allowed = STATUS_TRANSITIONS[current_slug];
    if (!allowed || !allowed.includes(input.status_slug)) {
      throw new BadRequestError(
        `Недопустимый переход статуса: "${current_slug}" → "${input.status_slug}"`
      );
    }

    // Получаем ID нового статуса
    const newStatus = await dbClient.query(
      'SELECT id, is_final FROM order_statuses WHERE slug = $1',
      [input.status_slug]
    );
    if (newStatus.rows.length === 0) throw new NotFoundError('Статус');

    const newStatusId = newStatus.rows[0].id;
    const newIsFinal = newStatus.rows[0].is_final;

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
// POST /orders/:id/parts — списание запчасти на заказ
// ============================================================
ordersRouter.post('/:id/parts', requireRole('admin', 'master'), async (req, res, next) => {
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const input = assignPartsSchema.parse(req.body);

    await dbClient.query('BEGIN');

    // Проверяем, что заказ существует и не в финальном статусе
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

    // Проверяем остаток запчасти
    const part = await dbClient.query(
      'SELECT id, name, purchase_price, selling_price, quantity FROM parts WHERE id = $1',
      [input.part_id]
    );
    if (part.rows.length === 0) throw new NotFoundError('Запчасть');

    const { name, purchase_price, selling_price, quantity } = part.rows[0];

    if (quantity < input.quantity) {
      throw new BadRequestError(
        `Недостаточно запчастей "${name}". Доступно: ${quantity}, требуется: ${input.quantity}`
      );
    }

    // Списываем со склада
    await dbClient.query(
      'UPDATE parts SET quantity = quantity - $1 WHERE id = $2',
      [input.quantity, input.part_id]
    );

    // Добавляем запись в order_parts
    await dbClient.query(
      `INSERT INTO order_parts (order_id, part_id, quantity_used, purchase_price_at_moment, selling_price_at_moment)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.part_id, input.quantity, purchase_price, selling_price]
    );

    // Добавляем запись в part_movements
    await dbClient.query(
      `INSERT INTO part_movements (part_id, type, quantity, order_id)
       VALUES ($1, 'outgoing', $2, $3)`,
      [input.part_id, input.quantity, id]
    );

    await dbClient.query('COMMIT');

    res.json({ message: 'Запчасть списана', part_name: name, quantity: input.quantity });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    next(error);
  } finally {
    dbClient.release();
  }
});
