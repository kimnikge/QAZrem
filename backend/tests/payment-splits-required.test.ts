/**
 * Интеграционные тесты: обязательная разбивка по кассам для крупных платежей.
 *
 * Платежи от SPLIT_REQUIRED_MIN_AMOUNT обязаны иметь splits,
 * сумма которых в точности равна сумме платежа.
 * Запуск: npm test (из backend/)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { closePool } from '../src/db/pool.js';
import { SPLIT_REQUIRED_MIN_AMOUNT } from '../src/services/payment.service.js';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
  throw new Error('ADMIN_LOGIN и ADMIN_PASSWORD обязательны для тестов — задайте их в .env');
}

const TEST_IMEI = `7${Date.now().toString().slice(-13)}`;

let adminToken = '';
let orderId = 0;
let paymentMethodId = 0;
let accountCashId = 0;
let accountBankId = 0;

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
  accountBankId = accounts.body.find((a: any) => a.type === 'bank')?.id || accountCashId;

  // Создаём заказ-фикстуру
  const orderRes = await request(app)
    .post('/orders')
    .set(auth(adminToken))
    .send({
      client: { name: 'Клиент Сплиты Обязательные', phone: '+77001234567' },
      device: { brand: 'Samsung', model: 'Galaxy S24', imei: TEST_IMEI },
      issue_description: 'Тест обязательной разбивки по кассам',
      source: 'test',
    })
    .expect(201);
  orderId = orderRes.body.id;
});

afterAll(async () => {
  await closePool();
});

describe('Обязательная разбивка по кассам (крупные платежи)', () => {
  it('отклоняет крупный платёж без разбивки по кассам', async () => {
    const res = await request(app)
      .post('/payments')
      .set(auth(adminToken))
      .send({
        order_id: orderId,
        amount: SPLIT_REQUIRED_MIN_AMOUNT,
        payment_method_id: paymentMethodId,
      })
      .expect(400);
    expect(res.body.error).toContain('разбивка по кассам');
  });

  it('отклоняет крупный платёж с неполной разбивкой', async () => {
    const res = await request(app)
      .post('/payments')
      .set(auth(adminToken))
      .send({
        order_id: orderId,
        amount: SPLIT_REQUIRED_MIN_AMOUNT,
        payment_method_id: paymentMethodId,
        splits: [{ account_id: accountCashId, amount: SPLIT_REQUIRED_MIN_AMOUNT - 2000 }],
      })
      .expect(400);
    expect(res.body.error).toContain('не совпадает');
  });

  it('проводит крупный платёж с корректной разбивкой', async () => {
    const res = await request(app)
      .post('/payments')
      .set(auth(adminToken))
      .send({
        order_id: orderId,
        amount: SPLIT_REQUIRED_MIN_AMOUNT,
        payment_method_id: paymentMethodId,
        splits: [
          { account_id: accountCashId, amount: SPLIT_REQUIRED_MIN_AMOUNT - 3000 },
          { account_id: accountBankId, amount: 3000 },
        ],
      })
      .expect(201);
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('мелкий платёж без разбивки по-прежнему проходит', async () => {
    const res = await request(app)
      .post('/payments')
      .set(auth(adminToken))
      .send({
        order_id: orderId,
        amount: SPLIT_REQUIRED_MIN_AMOUNT - 1,
        payment_method_id: paymentMethodId,
      })
      .expect(201);
    expect(res.body.id).toBeGreaterThan(0);
  });
});
