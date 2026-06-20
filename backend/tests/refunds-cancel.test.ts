/**
 * Интеграционные тесты: возвраты платежей и отмена заказа.
 *
 * Запуск: npm test (из backend/)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { closePool } from '../src/db/pool.js';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'MISTIK-XXX';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Detka0300304345';

const TEST_IMEI = `8${Date.now().toString().slice(-13)}`;

let adminToken = '';
let orderId = 0;
let paymentId = 0;
let paymentMethodId = 0;
let partId = 0;
let accountCashId = 0;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD })
    .expect(200);
  adminToken = res.body.token;

  const settings = await request(app).get('/settings').set(auth(adminToken)).expect(200);
  paymentMethodId = settings.body.payment_methods[0]?.id || 1;

  const accounts = await request(app).get('/accounts').set(auth(adminToken)).expect(200);
  accountCashId = accounts.body.find((a: any) => a.type === 'cash')?.id || 1;

  // Находим запчасть с остатком
  const parts = await request(app).get('/parts').set(auth(adminToken)).expect(200);
  const p = parts.body.find((x: any) => x.quantity > 0);
  if (p) partId = p.id;

  // Создаём заказ для тестов возврата
  const orderRes = await request(app)
    .post('/orders')
    .set(auth(adminToken))
    .send({
      client: { name: 'Клиент Возврат', phone: '+77009999999' },
      device: { brand: 'Samsung', model: 'Galaxy S24', imei: TEST_IMEI },
      issue_description: 'Тест возврата платежа',
      source: 'test',
    })
    .expect(201);
  orderId = orderRes.body.id;
});

afterAll(async () => {
  await closePool();
});

// ═══════════════════════════════════════════════════════════
// Группа 1: Возвраты платежей
// ═══════════════════════════════════════════════════════════
describe('Возвраты платежей', () => {

  it('принимает платёж для теста возврата', async () => {
    const res = await request(app)
      .post('/payments')
      .set(auth(adminToken))
      .send({
        order_id: orderId,
        amount: 10000,
        payment_method_id: paymentMethodId,
        splits: [{ account_id: accountCashId, amount: 10000 }],
      })
      .expect(201);
    paymentId = res.body.id;
    expect(paymentId).toBeGreaterThan(0);
  });

  it('делает возврат платежа с указанием причины', async () => {
    const res = await request(app)
      .patch(`/payments/${paymentId}/refund`)
      .set(auth(adminToken))
      .send({ reason: 'Клиент передумал' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('НЕ даёт повторно вернуть уже возвращённый платёж', async () => {
    await request(app)
      .patch(`/payments/${paymentId}/refund`)
      .set(auth(adminToken))
      .send({ reason: 'Ещё раз' })
      .expect(400);
  });

  it('видит возврат в списке возвратов', async () => {
    const res = await request(app)
      .get('/payments/refunds')
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const r = res.body.find((x: any) => x.id === paymentId);
    expect(r).toBeDefined();
    expect(r.refund_reason).toBe('Клиент передумал');
    expect(r.refunded_at).not.toBeNull();
  });

  it('видит refunded_at в деталях заказа', async () => {
    const res = await request(app)
      .get(`/orders/${orderId}`)
      .set(auth(adminToken))
      .expect(200);

    const p = res.body.payments.find((x: any) => x.id === paymentId);
    expect(p).toBeDefined();
    expect(p.refunded_at).not.toBeNull();
    expect(p.refund_reason).toBe('Клиент передумал');
  });

  it('принимает новый платёж после возврата', async () => {
    const res = await request(app)
      .post('/payments')
      .set(auth(adminToken))
      .send({
        order_id: orderId,
        amount: 5000,
        payment_method_id: paymentMethodId,
      })
      .expect(201);
    expect(res.body.id).toBeGreaterThan(0);
    paymentId = res.body.id;
  });
});

// ═══════════════════════════════════════════════════════════
// Группа 2: Отмена заказа
// ═══════════════════════════════════════════════════════════
describe('Отмена заказа', () => {
  let cancelOrderId = 0;

  it('создаёт новый заказ для отмены', async () => {
    const imei = `7${Date.now().toString().slice(-13)}`;
    const res = await request(app)
      .post('/orders')
      .set(auth(adminToken))
      .send({
        client: { name: 'Клиент Отмена', phone: '+77008888888' },
        device: { brand: 'Xiaomi', model: 'Redmi Note', imei },
        issue_description: 'Тест отмены заказа',
        source: 'test',
      })
      .expect(201);
    cancelOrderId = res.body.id;
  });

  it('отменяет заказ из статуса new', async () => {
    await request(app)
      .patch(`/orders/${cancelOrderId}/status`)
      .set(auth(adminToken))
      .send({ status_slug: 'cancelled', comment: 'Клиент отказался' })
      .expect(200);

    const res = await request(app)
      .get(`/orders/${cancelOrderId}`)
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.status_slug).toBe('cancelled');
  });

  it('НЕ даёт изменить статус отменённого заказа', async () => {
    await request(app)
      .patch(`/orders/${cancelOrderId}/status`)
      .set(auth(adminToken))
      .send({ status_slug: 'diagnosis' })
      .expect(400);
  });

  it('НЕ даёт добавить запчасть в отменённый заказ', async () => {
    if (!partId) return;
    await request(app)
      .post(`/orders/${cancelOrderId}/parts`)
      .set(auth(adminToken))
      .send({ part_id: partId, quantity: 1 })
      .expect(400);
  });

  it('НЕ даёт принять платёж по отменённому заказу', async () => {
    await request(app)
      .post('/payments')
      .set(auth(adminToken))
      .send({
        order_id: cancelOrderId,
        amount: 1000,
        payment_method_id: paymentMethodId,
      })
      .expect(400);
  });
});
