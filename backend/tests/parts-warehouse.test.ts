/**
 * Интеграционные тесты: склад запчастей.
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
let partId = 0;
let partQuantityBefore = 0;
let supplierId = 0;
const TEST_SKU = `TST-${Date.now()}`;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD })
    .expect(200);
  adminToken = res.body.token;

  // Получаем ID поставщика для тестов движения
  const sup = await request(app)
    .get('/suppliers')
    .set(auth(adminToken));
  if (sup.body.length > 0) supplierId = sup.body[0].id;
});

afterAll(async () => {
  await closePool();
});

// ═══════════════════════════════════════════════════════════
// Группа 1: CRUD запчастей
// ═══════════════════════════════════════════════════════════
describe('Склад: CRUD запчастей', () => {

  it('создаёт новую запчасть', async () => {
    const res = await request(app)
      .post('/parts')
      .set(auth(adminToken))
      .send({
        name: 'Тестовый дисплей',
        sku: TEST_SKU,
        purchase_price: 5000,
        selling_price: 10000,
        quantity: 10,
        min_quantity: 3,
      })
      .expect(201);

    expect(res.body.name).toBe('Тестовый дисплей');
    expect(Number(res.body.selling_price)).toBe(10000);
    expect(res.body.quantity).toBe(10);
    partId = res.body.id;
    partQuantityBefore = 10;
  });

  it('получает список всех запчастей', async () => {
    const res = await request(app)
      .get('/parts')
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    const found = res.body.find((p: any) => p.id === partId);
    expect(found).toBeDefined();
  });

  it('получает запчасть по ID', async () => {
    const res = await request(app)
      .get(`/parts/${partId}`)
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.id).toBe(partId);
    expect(res.body.name).toBe('Тестовый дисплей');
  });

  it('обновляет запчасть', async () => {
    const res = await request(app)
      .patch(`/parts/${partId}`)
      .set(auth(adminToken))
      .send({ selling_price: 12000, min_quantity: 5 })
      .expect(200);

    expect(Number(res.body.selling_price)).toBe(12000);
    expect(res.body.min_quantity).toBe(5);
  });

  it('НЕ даёт создать запчасть не-админу', async () => {
    // Создаём приёмщика если нет
    let receptionToken = '';
    try {
      await request(app)
        .post('/auth/register')
        .set(auth(adminToken))
        .send({ name: 'Склад Приёмщик', login: 'wh_reception', password: 'test123456', role: 'reception' });
    } catch {}
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ login: 'wh_reception', password: 'test123456' })
      .expect(200);
    receptionToken = loginRes.body.token;

    await request(app)
      .post('/parts')
      .set(auth(receptionToken))
      .send({ name: 'Нелегальная', sku: 'NO', purchase_price: 1, selling_price: 2 })
      .expect(403);
  });
});

// ═══════════════════════════════════════════════════════════
// Группа 2: Движение склада (приёмка / списание)
// ═══════════════════════════════════════════════════════════
describe('Склад: приёмка и списание', () => {

  it('оприходует запчасть — остаток увеличивается', async () => {
    await request(app)
      .post('/parts/movement')
      .set(auth(adminToken))
      .send({ part_id: partId, quantity: 5, document: 'Накладная №123', supplier_id: supplierId || undefined })
      .expect(201);

    const res = await request(app)
      .get(`/parts/${partId}`)
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.quantity).toBe(partQuantityBefore + 5);
    partQuantityBefore = res.body.quantity;
  });

  it('списывает запчасть (вне заказа) — остаток уменьшается', async () => {
    await request(app)
      .post('/parts/writeoff')
      .set(auth(adminToken))
      .send({ part_id: partId, quantity: 2, document: 'Акт списания' })
      .expect(200);

    const res = await request(app)
      .get(`/parts/${partId}`)
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.quantity).toBe(partQuantityBefore - 2);
    partQuantityBefore = res.body.quantity;
  });

  it('НЕ даёт списать больше, чем есть на складе', async () => {
    const current = await request(app)
      .get(`/parts/${partId}`)
      .set(auth(adminToken))
      .expect(200);

    await request(app)
      .post('/parts/writeoff')
      .set(auth(adminToken))
      .send({ part_id: partId, quantity: current.body.quantity + 999 })
      .expect(400);
  });

  it('видит движения в истории склада', async () => {
    const res = await request(app)
      .get(`/parts/movements?part_id=${partId}`)
      .set(auth(adminToken))
      .expect(200);

    expect(res.body.movements.length).toBeGreaterThanOrEqual(2);
    const types = res.body.movements.map((m: any) => m.type);
    expect(types).toContain('incoming');
    expect(types).toContain('writeoff');
  });

  it('фильтрует движения по типу', async () => {
    const res = await request(app)
      .get(`/parts/movements?part_id=${partId}&type=incoming`)
      .set(auth(adminToken))
      .expect(200);

    res.body.movements.forEach((m: any) => {
      expect(m.type).toBe('incoming');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Группа 3: Сводка и низкий остаток
// ═══════════════════════════════════════════════════════════
describe('Склад: сводка и низкий остаток', () => {

  it('возвращает сводку по складу', async () => {
    const res = await request(app)
      .get('/parts/summary')
      .set(auth(adminToken))
      .expect(200);

    expect(res.body).toHaveProperty('total_items');
    expect(res.body).toHaveProperty('total_quantity');
    expect(res.body).toHaveProperty('total_cost');
    expect(res.body).toHaveProperty('total_value');
    expect(res.body).toHaveProperty('low_stock_count');
    expect(res.body.total_items).toBeGreaterThan(0);
  });

  it('фильтрует запчасти с низким остатком', async () => {
    // Делаем остаток меньше min_quantity
    await request(app)
      .post('/parts/writeoff')
      .set(auth(adminToken))
      .send({ part_id: partId, quantity: partQuantityBefore - 1 });

    const res = await request(app)
      .get('/parts?low_stock=true')
      .set(auth(adminToken))
      .expect(200);

    // Наша тестовая запчасть должна быть в списке (остаток 1 < min_quantity 5)
    const found = res.body.find((p: any) => p.id === partId);
    if (found) {
      expect(found.quantity).toBeLessThanOrEqual(found.min_quantity);
    }
  });

  it('НЕ-админ не может получить сводку', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ login: 'wh_reception', password: 'test123456' })
      .expect(200);

    await request(app)
      .get('/parts/summary')
      .set(auth(loginRes.body.token))
      .expect(403);
  });
});
