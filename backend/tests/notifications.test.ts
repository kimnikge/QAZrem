/**
 * Интеграционные тесты: уведомления по складу (ТЗ Блок 11, после доработки 5)
 * Запуск: npm test (из backend/)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { closePool, pool } from '../src/db/pool.js';

// Не ходим в сеть: Telegram замокан
vi.mock('../src/services/telegram.js', () => ({
  sendTelegramMessage: vi.fn(async () => ({ sent: true })),
}));

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'MISTIK-XXX';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Detka0300304345';
const ts = Date.now();

let adminToken = '';
let adminId = 0;
let testPartId = 0;
let testOrderId = 0;
let testSupplierId = 0;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function feed() {
  const res = await request(app).get('/notifications').set(auth(adminToken)).expect(200);
  return res.body as { notifications: Array<{ id: number; type_code: string; title: string; payload: Record<string, unknown>; read_at: string | null }>; unread_count: number };
}

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/auth/login')
    .send({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD })
    .expect(200);
  adminToken = loginRes.body.token;

  // Находим id админа (для настроек получателя)
  const users = await request(app).get('/users').set(auth(adminToken)).expect(200);
  adminId = users.body.find((u: any) => u.role === 'admin')?.id ?? 0;

  const part = await request(app)
    .post('/parts')
    .set(auth(adminToken))
    .send({ name: `TEST-увед-${ts}`, purchase_price: 500, selling_price: 1000, min_quantity: 5 })
    .expect(201);
  testPartId = part.body.id;

  const sups = await request(app).get('/suppliers').set(auth(adminToken)).expect(200);
  testSupplierId = sups.body[0]?.id ?? 0;
});

afterAll(async () => {
  await pool.query('DELETE FROM notification_settings WHERE user_id = $1', [adminId]);
  await closePool();
});

describe('Уведомления по складу (Блок 11)', () => {
  it('справочник содержит 8 типов', async () => {
    const res = await request(app).get('/notifications/types').set(auth(adminToken)).expect(200);
    expect(res.body.length).toBe(8);
    const codes = res.body.map((t: any) => t.code);
    for (const code of ['low_stock', 'zero_stock', 'stale', 'return_order', 'incoming', 'inventory', 'return_supplier', 'reservation_cancelled']) {
      expect(codes).toContain(code);
    }
  });

  it('оприходование создаёт уведомление incoming', async () => {
    await request(app)
      .post('/parts/movement')
      .set(auth(adminToken))
      .send({ part_id: testPartId, quantity: 2, supplier_id: testSupplierId, batch_number: `NOTIF-${ts}` })
      .expect(201);

    const f = await feed();
    const incoming = f.notifications.find((n) => n.type_code === 'incoming' && n.payload.part_id === testPartId);
    expect(incoming).toBeDefined();
  });

  it('списание до нуля создаёт zero_stock', async () => {
    await request(app)
      .post('/parts/writeoff')
      .set(auth(adminToken))
      .send({ part_id: testPartId, quantity: 2, document: 'увед-тест' })
      .expect(200);

    const f = await feed();
    const zero = f.notifications.find((n) => n.type_code === 'zero_stock' && n.payload.part_id === testPartId);
    expect(zero).toBeDefined();
  });

  it('настройки получателей: сохранить и прочитать', async () => {
    await request(app)
      .put('/notifications/settings')
      .set(auth(adminToken))
      .send({ user_id: adminId, type_code: 'incoming', channel: 'app', enabled: true })
      .expect(200);

    const res = await request(app).get('/notifications/settings').set(auth(adminToken)).expect(200);
    const row = res.body.find((s: any) => s.user_id === adminId && s.type_code === 'incoming');
    expect(row).toBeDefined();
    expect(row.enabled).toBe(true);
  });

  it('отметить уведомление прочитанным и read-all', async () => {
    const f = await feed();
    const id = Number(f.notifications[0]?.id ?? 0);
    expect(id).toBeGreaterThan(0);
    await request(app).post(`/notifications/${id}/read`).set(auth(adminToken)).expect(200);
    await request(app).post('/notifications/read-all').set(auth(adminToken)).expect(200);
    const after = await feed();
    expect(after.unread_count).toBe(0);
  });

  it('stale-check возвращает число созданных (≥ 0)', async () => {
    const res = await request(app)
      .post('/notifications/stale-check')
      .set(auth(adminToken))
      .send({ days: 1 })
      .expect(200);
    expect(res.body.created).toBeGreaterThanOrEqual(0);
  });

  it('отмена заказа снимает резерв и создаёт reservation_cancelled', async () => {
    // Возвращаем остаток, чтобы можно было зарезервировать
    await request(app)
      .post('/parts/movement')
      .set(auth(adminToken))
      .send({ part_id: testPartId, quantity: 5, supplier_id: testSupplierId, batch_number: `NOTIF2-${ts}` })
      .expect(201);

    const imei = `881${ts.toString().slice(-12)}`;
    const order = await request(app)
      .post('/orders')
      .set(auth(adminToken))
      .send({
        client: { name: 'TEST-увед-клиент', phone: `+7777${ts.toString().slice(-6)}` },
        device: { brand: 'Apple', model: 'Notif', imei },
        issue_description: 'увед-тест',
        source: 'test',
      })
      .expect(201);
    testOrderId = order.body.id;

    await request(app)
      .post(`/orders/${testOrderId}/reserve`)
      .set(auth(adminToken))
      .send({ part_id: testPartId, quantity: 1 })
      .expect(201);

    await request(app)
      .patch(`/orders/${testOrderId}/status`)
      .set(auth(adminToken))
      .send({ status_slug: 'cancelled', comment: 'увед-тест' })
      .expect(200);

    const f = await feed();
    const cancelled = f.notifications.find((n) => n.type_code === 'reservation_cancelled' && n.payload.order_id === testOrderId);
    expect(cancelled).toBeDefined();
  });
});
