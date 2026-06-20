/**
 * Интеграционные тесты: кассовые операции — приход, изъятие (расход),
 * создание кассы, валидация баланса.
 *
 * Запуск: npm test (из backend/)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { closePool } from '../src/db/pool.js';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'MISTIK-XXX';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Detka0300304345';

let adminToken = '';
let testAccountId = 0;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD })
    .expect(200);
  adminToken = res.body.token;
});

afterAll(async () => {
  // Удаляем тестовую кассу если была создана
  if (testAccountId > 0) {
    try {
      await request(app)
        .patch(`/accounts/${testAccountId}`)
        .set(auth(adminToken))
        .send({ is_active: false });
    } catch {}
  }
  await closePool();
});

// ═══════════════════════════════════════════════════════════
// Группа 1: Создание и управление кассами
// ═══════════════════════════════════════════════════════════
describe('Кассы: создание и управление', () => {

  it('получает список активных касс', async () => {
    const res = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    res.body.forEach((a: any) => {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('name');
      expect(a).toHaveProperty('balance');
      expect(a).toHaveProperty('type');
    });
  });

  it('создаёт новую кассу (тестовую)', async () => {
    const res = await request(app)
      .post('/accounts')
      .set(auth(adminToken))
      .send({ name: 'Тестовая касса', type: 'kaspi' })
      .expect(201);

    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.name).toBe('Тестовая касса');
    expect(res.body.type).toBe('kaspi');
    expect(Number(res.body.balance)).toBe(0);
    testAccountId = res.body.id;
  });

  it('новая касса видна в списке', async () => {
    const res = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    const found = res.body.find((a: any) => a.id === testAccountId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Тестовая касса');
  });
});

// ═══════════════════════════════════════════════════════════
// Группа 2: Приход в кассу
// ═══════════════════════════════════════════════════════════
describe('Кассы: приход (income)', () => {

  it('вносит приход 50 000 ₸ в тестовую кассу', async () => {
    const res = await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'income', amount: 50000, description: 'Пополнение тестовой кассы' })
      .expect(201);

    expect(res.body.type).toBe('income');
    expect(Number(res.body.amount)).toBe(50000);
    expect(res.body.description).toBe('Пополнение тестовой кассы');
  });

  it('баланс кассы увеличился до 50 000 ₸', async () => {
    const res = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    const acc = res.body.find((a: any) => a.id === testAccountId);
    expect(acc).toBeDefined();
    expect(Number(acc.balance)).toBe(50000);
  });

  it('вносит ещё 10 000 ₸ — баланс 60 000 ₸', async () => {
    await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'income', amount: 10000, description: 'Доп. пополнение' })
      .expect(201);

    const res = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    const acc = res.body.find((a: any) => a.id === testAccountId);
    expect(Number(acc.balance)).toBe(60000);
  });
});

// ═══════════════════════════════════════════════════════════
// Группа 3: Изъятие из кассы (расход / expense)
// ═══════════════════════════════════════════════════════════
describe('Кассы: изъятие (expense)', () => {

  it('изымает 15 000 ₸ из кассы — баланс 45 000 ₸', async () => {
    const res = await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'expense', amount: 15000, description: 'Изъятие: оплата поставщику' })
      .expect(201);

    expect(res.body.type).toBe('expense');
    expect(Number(res.body.amount)).toBe(15000);
    expect(res.body.description).toBe('Изъятие: оплата поставщику');

    const acc = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    const found = acc.body.find((a: any) => a.id === testAccountId);
    expect(Number(found.balance)).toBe(45000);
  });

  it('изымает ещё 5 000 ₸ — баланс 40 000 ₸', async () => {
    await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'expense', amount: 5000, description: 'Изъятие: ком. услуги' })
      .expect(201);

    const acc = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    const found = acc.body.find((a: any) => a.id === testAccountId);
    expect(Number(found.balance)).toBe(40000);
  });

  it('НЕ даёт изъять больше баланса (40 000 при балансе 40 000)', async () => {
    const res = await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'expense', amount: 40001, description: 'Попытка изъять больше баланса' })
      .expect(400);

    expect(res.body.error).toContain('Недостаточно');
  });

  it('баланс не изменился после неудачной попытки', async () => {
    const acc = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    const found = acc.body.find((a: any) => a.id === testAccountId);
    expect(Number(found.balance)).toBe(40000);
  });

  it('изымает ровно остаток — баланс становится 0', async () => {
    await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'expense', amount: 40000, description: 'Полное изъятие остатка' })
      .expect(201);

    const acc = await request(app)
      .get('/accounts')
      .set(auth(adminToken))
      .expect(200);

    const found = acc.body.find((a: any) => a.id === testAccountId);
    expect(Number(found.balance)).toBe(0);
  });

  it('НЕ даёт изъять при нулевом балансе', async () => {
    const res = await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'expense', amount: 1, description: 'Попытка изъять при 0' })
      .expect(400);

    expect(res.body.error).toContain('Недостаточно');
  });
});

// ═══════════════════════════════════════════════════════════
// Группа 4: История операций кассы
// ═══════════════════════════════════════════════════════════
describe('Кассы: история операций', () => {

  it('отображает все операции в истории', async () => {
    // Пополняем снова для наглядности
    const addRes = await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'income', amount: 25000, description: 'Финальное пополнение' })
      .expect(201);

    const res = await request(app)
      .get(`/accounts/${testAccountId}/transactions`)
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.transactions).toBeDefined();
    expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);

    // Проверяем приход
    const incomes = res.body.transactions.filter((t: any) => t.type === 'manual_income' || t.type === 'income');
    expect(incomes.length).toBeGreaterThanOrEqual(1);

    // Проверяем расходы (изъятия)
    const outcomes = res.body.transactions.filter((t: any) => t.type === 'manual_expense' || t.type === 'expense');
    expect(outcomes.length).toBeGreaterThanOrEqual(1);

    // Самая свежая транзакция — последняя в отсортированном по возрастанию массиве
    const lastTx = res.body.transactions[res.body.transactions.length - 1];
    expect(lastTx.description).toBe('Финальное пополнение');
    expect(Number(lastTx.income)).toBe(25000);

    // Баланс последней транзакции должен быть > 0 (накопительный)
    expect(Number(lastTx.balance)).toBeGreaterThan(0);
  });

  it('операции содержат описания', async () => {
    const res = await request(app)
      .get(`/accounts/${testAccountId}/transactions`)
      .set(auth(adminToken))
      .expect(200);

    const withDescription = res.body.transactions.filter((t: any) => t.description);
    expect(withDescription.length).toBeGreaterThan(0);
    // Последняя транзакция (самая свежая) — последняя в массиве
    const lastDesc = res.body.transactions[res.body.transactions.length - 1].description.toLowerCase();
    expect(lastDesc).toContain('пополнение');
  });
});

// ═══════════════════════════════════════════════════════════
// Группа 5: Валидация входных данных
// ═══════════════════════════════════════════════════════════
describe('Кассы: валидация операций', () => {

  it('НЕ даёт создать операцию без типа', async () => {
    await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ amount: 100 })
      .expect(400);
  });

  it('НЕ даёт создать операцию с отрицательной суммой', async () => {
    await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'income', amount: -500 })
      .expect(400);
  });

  it('НЕ даёт создать операцию с нулевой суммой', async () => {
    await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'income', amount: 0 })
      .expect(400);
  });

  it('НЕ даёт создать операцию для несуществующей кассы', async () => {
    await request(app)
      .post('/accounts/99999/operations')
      .set(auth(adminToken))
      .send({ type: 'income', amount: 1000 })
      .expect(404);
  });

  it('НЕ даёт указать неверный тип операции', async () => {
    await request(app)
      .post(`/accounts/${testAccountId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'transfer', amount: 100 })
      .expect(400);
  });
});
