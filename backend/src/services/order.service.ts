// ═══════════════════════════════════════════════════════════
// Order Service — слой бизнес-логики для заказов.
//
// Принимает snake_case (контракт API/БД) — роутер передаёт
// данные напрямую после Zod-валидации, без преобразований.
// ═══════════════════════════════════════════════════════════

import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { STATUS_TRANSITIONS } from '../types/domain.js';
import { sendTelegramMessage } from './telegram.js';

// ─── Константы ──────────────────────────────────────────

/** Процент комиссии мастера по умолчанию */
const DEFAULT_COMMISSION_PCT = 50;

// ─── Пересчёт стоимости заказа ─────────────────────────

export async function recalcOrderCost(
  client: PoolClient | typeof pool,
  orderId: number,
): Promise<void> {
  const result = await client.query(
    `SELECT
      COALESCE((SELECT SUM(op.selling_price_at_moment * op.quantity_used) FROM order_parts op WHERE op.order_id = $1), 0) +
      COALESCE((SELECT SUM(osrv.price_at_moment * osrv.quantity) FROM order_services osrv WHERE osrv.order_id = $1), 0) AS total`,
    [orderId],
  );
  const cost = Math.round(Number(result.rows[0].total));
  await client.query('UPDATE orders SET cost = $1 WHERE id = $2', [cost, orderId]);
}

// ─── Создание заказа ────────────────────────────────────

/**
 * Принимает результат Zod-валидации (snake_case) напрямую.
 * Роутер: `const input = schema.parse(req.body); createOrder(input, req.user!.userId);`
 */
export async function createOrder(
  input: Record<string, unknown>,
  createdByUserId: number,
): Promise<number> {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    let deviceId: number;

    if (input.device_id) {
      // Сценарий A: существующее устройство
      const device = await dbClient.query(
        'SELECT id, brand, model FROM devices WHERE id = $1',
        [input.device_id],
      );
      if (device.rows.length === 0) throw new NotFoundError('Устройство');
      deviceId = device.rows[0].id;

      await dbClient.query(
        `INSERT INTO device_catalog (brand, model) VALUES ($1, $2) ON CONFLICT (brand, model) DO NOTHING`,
        [device.rows[0].brand, device.rows[0].model],
      );
    } else {
      const clientData = input.client as Record<string, string> | undefined;
      const deviceData = input.device as Record<string, string> | undefined;

      if (!clientData || !deviceData) {
        throw new BadRequestError('Не указаны данные клиента и устройства');
      }

      const discount = Number(input.discount ?? 0);
      const estimatedCost = Number(input.estimated_cost ?? 0);
      if (discount > estimatedCost) {
        throw new BadRequestError('Скидка не может превышать стоимость заказа');
      }

      let clientResult = await dbClient.query(
        'SELECT id FROM clients WHERE phone = $1',
        [clientData.phone],
      );

      let clientId: number;
      if (clientResult.rows.length > 0) {
        clientId = clientResult.rows[0].id;
      } else {
        clientResult = await dbClient.query(
          `INSERT INTO clients (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING id`,
          [clientData.name, clientData.phone, clientData.email || null, clientData.address || null],
        );
        clientId = clientResult.rows[0].id;
      }

      const deviceResult = await dbClient.query(
        `INSERT INTO devices (client_id, brand, model, imei, serial_number, color)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [clientId, deviceData.brand, deviceData.model, deviceData.imei,
         deviceData.serial_number || null, deviceData.color || null],
      );
      deviceId = deviceResult.rows[0].id;

      await dbClient.query(
        `INSERT INTO device_catalog (brand, model) VALUES ($1, $2) ON CONFLICT (brand, model) DO NOTHING`,
        [deviceData.brand, deviceData.model],
      );
    }

    // --- Комиссия мастера ---
    let masterCommissionPct = input.master_commission_pct as number | undefined;
    const masterId = input.master_id as number | undefined;

    if (masterCommissionPct === undefined && masterId) {
      const masterUser = await dbClient.query(
        'SELECT default_commission_pct FROM users WHERE id = $1',
        [masterId],
      );
      masterCommissionPct = masterUser.rows.length > 0
        ? Number(masterUser.rows[0].default_commission_pct)
        : DEFAULT_COMMISSION_PCT;
    }
    if (masterCommissionPct === undefined) masterCommissionPct = DEFAULT_COMMISSION_PCT;

    // --- Создаём заказ ---
    const statusResult = await dbClient.query("SELECT id FROM order_statuses WHERE slug = 'new'");
    const newStatusId = statusResult.rows[0].id;

    const orderResult = await dbClient.query(
      `INSERT INTO orders (device_id, master_id, status_id, issue_description, deadline, priority, source,
        estimated_cost, discount, master_commission_pct, group_id, location_id,
        password, face_id, completeness, condition, appearance, manager_notes, order_type, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id`,
      [
        deviceId, masterId || null, newStatusId,
        input.issue_description, input.deadline || null,
        input.priority || 'normal', input.source || null,
        input.estimated_cost || 0, input.discount || 0,
        masterCommissionPct, input.group_id || null, input.location_id || null,
        input.password || null, input.face_id || false,
        input.completeness || null, input.condition || null,
        input.appearance || null, input.manager_notes || null,
        input.order_type || 'paid', input.image_url || null,
      ],
    );
    const orderId: number = orderResult.rows[0].id;

    // --- История ---
    await dbClient.query(
      `INSERT INTO order_history (order_id, user_id, from_status_id, to_status_id, comment)
       VALUES ($1, $2, NULL, $3, 'Создан заказ')`,
      [orderId, createdByUserId, newStatusId],
    );

    // --- Списание запчастей (FIFO) ---
    const parts = (input.parts as Array<{ part_id: number; quantity: number }> | undefined) ?? [];
    await writeoffParts(dbClient, orderId, parts);

    // --- Добавление услуг ---
    const services = (input.services as Array<{ service_id: number; quantity: number }> | undefined) ?? [];
    await assignServices(dbClient, orderId, services);

    await dbClient.query('COMMIT');

    notifyNewOrder(orderId).catch((err) =>
      console.error('Telegram notification failed:', err instanceof Error ? err.message : err),
    );

    return orderId;
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
}

// ─── Смена статуса ─────────────────────────────────────

export async function updateOrderStatus(
  orderId: number,
  newSlug: string,
  userId: number,
  comment?: string,
): Promise<void> {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const order = await dbClient.query(
      `SELECT o.status_id, o.cost, o.discount, os.slug AS current_slug, os.is_final
       FROM orders o JOIN order_statuses os ON os.id = o.status_id WHERE o.id = $1`,
      [orderId],
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');

    const { current_slug, is_final, cost, discount } = order.rows[0];

    if (is_final) throw new BadRequestError('Нельзя изменить статус финального заказа');

    const allowedSlugs = STATUS_TRANSITIONS[current_slug] || [];
    if (!(allowedSlugs as readonly string[]).includes(newSlug)) {
      throw new BadRequestError(
        `Нельзя перевести заказ из статуса «${current_slug}» в «${newSlug}»`,
      );
    }

    const newStatus = await dbClient.query(
      'SELECT id, is_final FROM order_statuses WHERE slug = $1',
      [newSlug],
    );
    if (newStatus.rows.length === 0) throw new NotFoundError('Статус');

    const newStatusId = newStatus.rows[0].id;

    if (newSlug === 'completed') {
      const paymentSum = await dbClient.query(
        'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE order_id = $1',
        [orderId],
      );
      const totalPaid = Math.round(Number(paymentSum.rows[0].total_paid));
      const totalCost = Math.round(Number(cost)) - Math.round(Number(discount));
      if (totalPaid < totalCost) {
        throw new BadRequestError(
          `Нельзя выдать заказ: не полностью оплачен (оплачено ${totalPaid} из ${totalCost} ₸)`,
        );
      }
    }

    let updateSql = 'UPDATE orders SET status_id = $1';
    const updateParams: unknown[] = [newStatusId];

    if (newSlug === 'completed') {
      updateSql += ', completed_at = NOW()';
    }

    updateSql += ' WHERE id = $2 RETURNING id';
    updateParams.push(orderId);
    await dbClient.query(updateSql, updateParams);

    await dbClient.query(
      `INSERT INTO order_history (order_id, user_id, from_status_id, to_status_id, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, userId, order.rows[0].status_id, newStatusId, comment || null],
    );

    await dbClient.query('COMMIT');

    notifyStatusChange(orderId, newSlug).catch((err) =>
      console.error('Telegram status notification failed:', err instanceof Error ? err.message : err),
    );
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
}

// ─── Списание запчасти на заказ (FIFO) ─────────────────

export async function assignPartToOrder(
  orderId: number,
  partId: number,
  quantity: number,
): Promise<{ part_name: string; quantity: number }> {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const order = await dbClient.query(
      `SELECT o.id, os.is_final FROM orders o
       JOIN order_statuses os ON os.id = o.status_id WHERE o.id = $1`,
      [orderId],
    );
    if (order.rows.length === 0) throw new NotFoundError('Заказ');
    if (order.rows[0].is_final) throw new BadRequestError('Нельзя списать запчасть на завершённый заказ');

    const part = await dbClient.query(
      'SELECT id, name, selling_price, quantity FROM parts WHERE id = $1 FOR UPDATE',
      [partId],
    );
    if (part.rows.length === 0) throw new NotFoundError('Запчасть');

    const { name, selling_price, quantity: stockQty } = part.rows[0];
    if (stockQty < quantity) {
      throw new BadRequestError(
        `Недостаточно запчастей "${name}". Доступно: ${stockQty}, требуется: ${quantity}`,
      );
    }

    const batches = await dbClient.query(
      `SELECT id, batch_number, current_quantity, purchase_price
       FROM part_batches WHERE part_id = $1 AND current_quantity > 0
       ORDER BY received_at ASC FOR UPDATE`,
      [partId],
    );

    let remaining = quantity;
    for (const batch of batches.rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.current_quantity);
      remaining -= take;

      await dbClient.query('UPDATE part_batches SET current_quantity = current_quantity - $1 WHERE id = $2', [take, batch.id]);
      await dbClient.query(
        `INSERT INTO order_parts (order_id, part_id, quantity_used, purchase_price_at_moment, selling_price_at_moment, batch_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, partId, take, batch.purchase_price, selling_price, batch.id],
      );
      await dbClient.query(
        `INSERT INTO part_movements (part_id, type, quantity, order_id, batch_id, batch_number)
         VALUES ($1, 'outgoing', $2, $3, $4, $5)`,
        [partId, take, orderId, batch.id, batch.batch_number],
      );
    }

    if (remaining > 0) {
      throw new BadRequestError(`Несоответствие остатков: не хватает ${remaining}шт в партиях`);
    }

    await dbClient.query('UPDATE parts SET quantity = quantity - $1 WHERE id = $2', [quantity, partId]);
    await recalcOrderCost(dbClient, orderId);

    await dbClient.query('COMMIT');
    return { part_name: name, quantity };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
}

// ─── Приватные хелперы ─────────────────────────────────

async function writeoffParts(
  client: PoolClient,
  orderId: number,
  parts: Array<{ part_id: number; quantity: number }>,
): Promise<void> {
  for (const part of parts) {
    const stock = await client.query(
      'SELECT id, quantity, selling_price FROM parts WHERE id = $1 FOR UPDATE',
      [part.part_id],
    );
    if (stock.rows.length === 0) throw new NotFoundError(`Запчасть с id=${part.part_id}`);
    if (stock.rows[0].quantity < part.quantity) {
      throw new BadRequestError(
        `Недостаточно запчасти #${part.part_id} (остаток: ${stock.rows[0].quantity}, требуется: ${part.quantity})`,
      );
    }

    const sellingPrice = Number(stock.rows[0].selling_price);
    const batches = await client.query(
      `SELECT id, batch_number, current_quantity, purchase_price
       FROM part_batches WHERE part_id = $1 AND current_quantity > 0
       ORDER BY received_at ASC FOR UPDATE`,
      [part.part_id],
    );

    let remaining = part.quantity;
    for (const batch of batches.rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.current_quantity);
      remaining -= take;

      await client.query('UPDATE part_batches SET current_quantity = current_quantity - $1 WHERE id = $2', [take, batch.id]);
      await client.query(
        `INSERT INTO order_parts (order_id, part_id, quantity_used, purchase_price_at_moment, selling_price_at_moment, batch_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, part.part_id, take, batch.purchase_price, sellingPrice, batch.id],
      );
      await client.query(
        `INSERT INTO part_movements (part_id, type, quantity, order_id, batch_id, batch_number)
         VALUES ($1, 'outgoing', $2, $3, $4, $5)`,
        [part.part_id, take, orderId, batch.id, batch.batch_number],
      );
    }

    if (remaining > 0) {
      throw new BadRequestError(`Несоответствие остатков по запчасти #${part.part_id}: не хватает ${remaining}шт в партиях`);
    }

    await client.query('UPDATE parts SET quantity = quantity - $1 WHERE id = $2', [part.quantity, part.part_id]);
  }
}

async function assignServices(
  client: PoolClient,
  orderId: number,
  services: Array<{ service_id: number; quantity: number }>,
): Promise<void> {
  for (const svc of services) {
    const svcResult = await client.query(
      'SELECT price, master_commission_pct FROM services WHERE id = $1',
      [svc.service_id],
    );
    if (svcResult.rows.length === 0) throw new NotFoundError(`Услуга с id=${svc.service_id}`);

    await client.query(
      `INSERT INTO order_services (order_id, service_id, quantity, price_at_moment, master_commission_pct_at_moment)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, svc.service_id, svc.quantity || 1,
       Number(svcResult.rows[0].price), Number(svcResult.rows[0].master_commission_pct)],
    );
  }
}

async function notifyNewOrder(orderId: number): Promise<void> {
  const order = await pool.query(
    `SELECT o.id, c.name AS client_name, c.phone, d.brand, d.model, o.issue_description
     FROM orders o JOIN devices d ON d.id = o.device_id JOIN clients c ON c.id = d.client_id
     WHERE o.id = $1`,
    [orderId],
  );
  if (order.rows.length === 0) return;

  const o = order.rows[0];
  await sendTelegramMessage(
    `<b>🆕 Новый заказ</b>\n№${o.id} | ${o.brand} ${o.model}\nКлиент: ${o.client_name} (${o.phone})\nПроблема: ${o.issue_description}`,
  );
}

async function notifyStatusChange(orderId: number, newSlug: string): Promise<void> {
  const statusNames: Record<string, string> = {
    new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
    repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ',
  };

  const order = await pool.query(
    `SELECT o.id, c.name AS client_name, d.brand, d.model
     FROM orders o JOIN devices d ON d.id = o.device_id JOIN clients c ON c.id = d.client_id
     WHERE o.id = $1`,
    [orderId],
  );
  if (order.rows.length === 0) return;

  const o = order.rows[0];
  await sendTelegramMessage(
    `<b>📋 Статус заказа изменён</b>\n№${o.id} | ${o.brand} ${o.model}\nКлиент: ${o.client_name}\nНовый статус: ${statusNames[newSlug] || newSlug}`,
  );
}
