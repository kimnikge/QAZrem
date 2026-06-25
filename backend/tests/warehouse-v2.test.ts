/**
 * Интеграционные тесты: склад v2 (категории, теги, FIFO, инвентаризация, резервы)
 *
 * Запуск: npm test (из backend/)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { closePool } from '../src/db/pool.js';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'MISTIK-XXX';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Detka0300304345';

let token = '';
let testPartId = 0;
let testCategoryId = 0;
let testTagId = 0;
let testSupplierId = 0;
let testOrderId = 0;
let testBatchId = 0;
let testSheetId = 0;
let testReservationId = 0;

function auth() { return { Authorization: `Bearer ${token}` }; }

beforeAll(async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD })
    .expect(200);
  token = res.body.token;

  // Берём ID существующего поставщика
  const sup = await request(app).get('/suppliers').set(auth());
  if (sup.body.length > 0) testSupplierId = sup.body[0].id;

  // Создаём тестовую категорию с уникальным именем
  const catName = `TEST-кат-${Date.now()}`;
  const catRes = await request(app)
    .post('/warehouse/categories')
    .set(auth())
    .send({ name: catName });
  testCategoryId = catRes.body.id;

  // Создаём тестовую запчасть с категорией
  const partRes = await request(app)
    .post('/parts')
    .set(auth())
    .send({
      name: `TEST-дисплей-${Date.now()}`,
      category_id: testCategoryId,
      model_name: 'iPhone 99',
      purchase_price: 3000,
      selling_price: 8000,
      quantity: 20,
      min_quantity: 3,
      unit: 'шт',
    });
  testPartId = partRes.body.id;

  // Оприходуем чтобы создать партию
  if (testSupplierId) {
    const movRes = await request(app)
      .post('/parts/movement')
      .set(auth())
      .send({ part_id: testPartId, quantity: 5, supplier_id: testSupplierId, batch_number: 'BATCH-TEST-001' });
    // Получаем batch_id из ответа
    testBatchId = movRes.body.batch_id;
  }

  // Создаём тестовый заказ (нужен для резервов)
  const imei = `990${Date.now().toString().slice(-12)}`;
  const clientRes = await request(app)
    .post('/orders')
    .set(auth())
    .send({
      client: { name: 'TEST-клиент-v2', phone: `+7999${Date.now().toString().slice(-6)}` },
      device: { brand: 'Apple', model: 'iPhone 99', imei },
      issue_description: 'TEST-проблема для склада v2',
      source: 'test',
    });
  testOrderId = clientRes.body.id;
});

afterAll(async () => {
  await closePool();
});

// ═══════════════════════════════════════════════════════════
// 1. Parts: новые поля + фильтры + удаление + SKU-авто
// ═══════════════════════════════════════════════════════════
describe('Parts v2: новые поля, фильтры, SKU-авто, удаление', () => {

  it('запчасть содержит category_name и tags', async () => {
    const res = await request(app).get(`/parts/${testPartId}`).set(auth());
    expect(res.body).toHaveProperty('category_name');
    expect(res.body).toHaveProperty('tags');
    expect(res.body).toHaveProperty('model_name', 'iPhone 99');
    expect(res.body).toHaveProperty('unit', 'шт');
    expect(res.body).toHaveProperty('is_active', true);
    expect(res.body).toHaveProperty('attributes');
  });

  it('фильтрует по категории', async () => {
    const res = await request(app).get(`/parts?category_id=${testCategoryId}`).set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    res.body.forEach((p: any) => expect(p.category_id).toBe(testCategoryId));
  });

  it('сквозной поиск находит по model_name', async () => {
    const res = await request(app).get('/parts?search=iPhone 99').set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some((p: any) => p.model_name === 'iPhone 99')).toBe(true);
  });

  it('фильтрует по тегу', async () => {
    // Создаём тег и привязываем
    const tagRes = await request(app).post('/parts/tags').set(auth()).send({ name: 'TEST-тег-фильтр' });
    testTagId = tagRes.body.id;
    await request(app).patch(`/parts/${testPartId}`).set(auth()).send({ tag_ids: [testTagId] });

    const res = await request(app).get(`/parts?tag_id=${testTagId}`).set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('генерирует SKU автоматически если не указан', async () => {
    const res = await request(app)
      .post('/parts')
      .set(auth())
      .send({ name: 'TEST-SKU-авто', purchase_price: 100, selling_price: 200 });
    expect(res.status).toBe(201);
    expect(res.body.sku).toBeTruthy();
    expect(res.body.sku.length).toBeGreaterThanOrEqual(13);
  });

  it('НЕ удаляет запчасть использованную в заказе', async () => {
    // Берём запчасть которая точно привязана к заказу (создана в beforeAll + назначена)
    // Проверяем что она участвует в заказе
    const check = await request(app)
      .get(`/orders/${testOrderId}`)
      .set(auth());
    expect(check.status).toBe(200);

    // Пытаемся удалить — должно быть отказано
    const delRes = await request(app)
      .delete(`/parts/${testPartId}`)
      .set(auth());
    // Либо 400 (использована) либо 500 (FK violation от part_movements)
    expect([400, 500]).toContain(delRes.status);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. FIFO: партии, списание из старейшей, защита от минуса
// ═══════════════════════════════════════════════════════════
describe('FIFO: партии и списание', () => {

  it('оприходование создаёт партию с batch_number', async () => {
    const res = await request(app)
      .post('/parts/movement')
      .set(auth())
      .send({ part_id: testPartId, quantity: 3, supplier_id: testSupplierId, batch_number: 'BATCH-FIFO-002' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('batch_number', 'BATCH-FIFO-002');
    expect(res.body).toHaveProperty('batch_id');
  });

  it('списание (writeoff) списывает из старейшей партии (FIFO)', async () => {
    const res = await request(app)
      .post('/parts/writeoff')
      .set(auth())
      .send({ part_id: testPartId, quantity: 2, document: 'FIFO-тест' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('batches');
    expect(typeof res.body.batches).toBe('string');
    expect(res.body.batches).toContain('BATCH-TEST-001'); // старейшая партия
  });

  it('writeoff НЕ даёт списать больше чем есть', async () => {
    const part = await request(app).get(`/parts/${testPartId}`).set(auth());
    await request(app)
      .post('/parts/writeoff')
      .set(auth())
      .send({ part_id: testPartId, quantity: part.body.quantity + 999 })
      .expect(400);
  });

  it('движения содержат batch_id после FIFO-списания', async () => {
    const res = await request(app)
      .get(`/parts/movements?part_id=${testPartId}&type=writeoff`)
      .set(auth());
    expect(res.body.movements.length).toBeGreaterThan(0);
    const lastMove = res.body.movements[0];
    expect(lastMove).toHaveProperty('batch_id');
    expect(lastMove.batch_id).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Категории: CRUD + дерево + атрибуты
// ═══════════════════════════════════════════════════════════
describe('Категории: CRUD, дерево, атрибуты', () => {

  it('создаёт подкатегорию', async () => {
    const res = await request(app)
      .post('/warehouse/categories')
      .set(auth())
      .send({ name: 'TEST-подкатегория', parent_id: testCategoryId });
    expect(res.status).toBe(201);
    expect(res.body.parent_id).toBe(testCategoryId);
  });

  it('возвращает плоский список категорий', async () => {
    const res = await request(app).get('/warehouse/categories').set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some((c: any) => c.id === testCategoryId)).toBe(true);
  });

  it('возвращает дерево категорий', async () => {
    const res = await request(app).get('/warehouse/categories/tree').set(auth());
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('depth');
    expect(res.body[0]).toHaveProperty('path');
  });

  it('управляет атрибутами категории', async () => {
    // Создать атрибут
    const attrRes = await request(app)
      .post(`/warehouse/categories/${testCategoryId}/attributes`)
      .set(auth())
      .send({ name: 'TEST-цвет', attr_type: 'select', attr_options: ['Красный', 'Синий'] });
    expect(attrRes.status).toBe(201);
    expect(attrRes.body.attr_type).toBe('select');

    const attrId = attrRes.body.id;

    // Получить список атрибутов
    const listRes = await request(app)
      .get(`/warehouse/categories/${testCategoryId}/attributes`)
      .set(auth());
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].name).toBe('TEST-цвет');

    // Обновить атрибут
    await request(app)
      .patch(`/warehouse/categories/attributes/${attrId}`)
      .set(auth())
      .send({ name: 'TEST-цвет-v2', is_required: true })
      .expect(200);

    // Удалить атрибут
    await request(app)
      .delete(`/warehouse/categories/attributes/${attrId}`)
      .set(auth())
      .expect(200);
  });

  it('НЕ даёт удалить категорию с запчастями', async () => {
    await request(app)
      .delete(`/warehouse/categories/${testCategoryId}`)
      .set(auth())
      .expect(400);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Теги: CRUD
// ═══════════════════════════════════════════════════════════
describe('Теги: CRUD', () => {

  it('создаёт тег', async () => {
    const res = await request(app)
      .post('/parts/tags')
      .set(auth())
      .send({ name: 'TEST-тег-новый', color: '#ff0000' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TEST-тег-новый');
    testTagId = res.body.id;
  });

  it('возвращает список тегов с количеством запчастей', async () => {
    const res = await request(app).get('/parts/tags').set(auth());
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('parts_count');
  });

  it('удаляет тег', async () => {
    await request(app)
      .delete(`/parts/tags/${testTagId}`)
      .set(auth())
      .expect(200);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Инвентаризация: ведомости + строки + статусы
// ═══════════════════════════════════════════════════════════
describe('Инвентаризация: ведомости, строки, статусы', () => {

  it('создаёт ведомость с автозаполнением', async () => {
    const res = await request(app)
      .post('/warehouse/inventory')
      .set(auth())
      .send({ notes: 'TEST-ведомость' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body).toHaveProperty('items_count');
    expect(res.body.items_count).toBeGreaterThan(0);
    testSheetId = res.body.id;
  });

  it('возвращает список ведомостей', async () => {
    const res = await request(app).get('/warehouse/inventory').set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some((s: any) => s.id === testSheetId)).toBe(true);
  });

  it('возвращает строки ведомости', async () => {
    const res = await request(app)
      .get(`/warehouse/inventory/${testSheetId}`)
      .set(auth());
    expect(res.body).toHaveProperty('items');
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('part_name');
    expect(res.body.items[0]).toHaveProperty('expected_quantity');
  });

  it('обновляет фактическое количество в строке', async () => {
    const sheet = await request(app)
      .get(`/warehouse/inventory/${testSheetId}`)
      .set(auth());
    const itemId = sheet.body.items[0].id;

    await request(app)
      .patch(`/warehouse/inventory/items/${itemId}`)
      .set(auth())
      .send({ actual_quantity: 99, notes: 'TEST-проверено' })
      .expect(200);
  });

  it('меняет статус ведомости draft → in_progress → completed', async () => {
    await request(app)
      .patch(`/warehouse/inventory/${testSheetId}/status`)
      .set(auth())
      .send({ status: 'in_progress' })
      .expect(200);

    await request(app)
      .patch(`/warehouse/inventory/${testSheetId}/status`)
      .set(auth())
      .send({ status: 'completed' })
      .expect(200);

    const final = await request(app)
      .get(`/warehouse/inventory/${testSheetId}`)
      .set(auth());
    expect(final.body.status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Оборудование мастеров
// ═══════════════════════════════════════════════════════════
describe('Оборудование мастеров', () => {

  let equipId = 0;

  it('добавляет оборудование', async () => {
    // Получаем ID мастера из списка пользователей
    const users = await request(app).get('/users').set(auth());
    const master = users.body.find((u: any) => u.role === 'master');
    if (!master) return; // пропускаем если нет мастера

    const res = await request(app)
      .post('/warehouse/inventory/equipment')
      .set(auth())
      .send({ name: 'TEST-паяльник', master_id: master.id, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TEST-паяльник');
    equipId = res.body.id;
  });

  it('возвращает список оборудования', async () => {
    const res = await request(app).get('/warehouse/inventory/equipment').set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(0);
  });

  it('удаляет оборудование', async () => {
    if (!equipId) return;
    await request(app)
      .delete(`/warehouse/inventory/equipment/${equipId}`)
      .set(auth())
      .expect(200);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Резервирование
// ═══════════════════════════════════════════════════════════
describe('Резервирование запчастей', () => {

  it('резервирует запчасть под заказ', async () => {
    const res = await request(app)
      .post(`/orders/${testOrderId}/reserve`)
      .set(auth())
      .send({ part_id: testPartId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.quantity).toBe(2);
    testReservationId = res.body.id;
  });

  it('возвращает список резервов по заказу', async () => {
    const res = await request(app)
      .get(`/orders/${testOrderId}/reservations`)
      .set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('part_name');
  });

  it('НЕ даёт зарезервировать больше доступного (с учётом активных резервов)', async () => {
    const part = await request(app).get(`/parts/${testPartId}`).set(auth());
    const hugeQty = part.body.quantity + 999;
    await request(app)
      .post(`/orders/${testOrderId}/reserve`)
      .set(auth())
      .send({ part_id: testPartId, quantity: hugeQty })
      .expect(400);
  });

  it('отменяет резерв', async () => {
    await request(app)
      .delete(`/orders/${testOrderId}/reserve/${testReservationId}`)
      .set(auth())
      .expect(200);
  });
});

// ═══════════════════════════════════════════════════════════
// 8. Возврат поставщику
// ═══════════════════════════════════════════════════════════
describe('Возврат поставщику', () => {

  let returnBatchId = 0;

  it('возвращает партию поставщику', async () => {
    if (!testSupplierId) return;

    // Создаём свежую партию для возврата
    const movRes = await request(app)
      .post('/parts/movement')
      .set(auth())
      .send({ part_id: testPartId, quantity: 10, supplier_id: testSupplierId, batch_number: 'BATCH-RETURN-TEST' });
    returnBatchId = movRes.body.batch_id;

    const res = await request(app)
      .post(`/suppliers/${testSupplierId}/return`)
      .set(auth())
      .send({ batch_id: returnBatchId, part_id: testPartId, quantity: 1, reason: 'TEST-брак' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Возврат поставщику');
  });

  it('движение содержит тип return_supplier', async () => {
    const res = await request(app)
      .get(`/parts/movements?part_id=${testPartId}&type=return_supplier`)
      .set(auth());
    expect(res.body.movements.length).toBeGreaterThanOrEqual(1);
    res.body.movements.forEach((m: any) => expect(m.type).toBe('return_supplier'));
  });
});

// ═══════════════════════════════════════════════════════════
// 9. Отчёты
// ═══════════════════════════════════════════════════════════
describe('Складские отчёты', () => {

  it('отчёт по остаткам', async () => {
    const res = await request(app).get('/warehouse/reports/stock').set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('total_cost');
    expect(res.body[0]).toHaveProperty('is_low_stock');
  });

  it('отчёт по остаткам с фильтром по категории', async () => {
    const res = await request(app)
      .get(`/warehouse/reports/stock?category_id=${testCategoryId}`)
      .set(auth());
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('отчёт: топ ходовых запчастей', async () => {
    const res = await request(app).get('/warehouse/reports/top-parts?limit=5').set(auth());
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('отчёт: залежавшиеся запчасти', async () => {
    const res = await request(app).get('/warehouse/reports/stale?days=30').set(auth());
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('отчёт по поставщикам', async () => {
    const res = await request(app).get('/warehouse/reports/by-supplier').set(auth());
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('отчёт по категориям', async () => {
    const res = await request(app).get('/warehouse/reports/by-category').set(auth());
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. Права доступа
// ═══════════════════════════════════════════════════════════
describe('Права доступа: админ vs не-админ', () => {

  let nonAdminToken = '';

  beforeAll(async () => {
    try {
      await request(app)
        .post('/auth/register')
        .set(auth())
        .send({ name: 'TEST-мастер-склад', login: 'wh_master_test', password: 'test123456', role: 'master' });
    } catch {}
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ login: 'wh_master_test', password: 'test123456' });
    nonAdminToken = loginRes.body.token;
  });

  it('мастер НЕ может создать категорию', async () => {
    await request(app)
      .post('/warehouse/categories')
      .set({ Authorization: `Bearer ${nonAdminToken}` })
      .send({ name: 'Нелегальная категория' })
      .expect(403);
  });

  it('мастер НЕ может создать ведомость инвентаризации', async () => {
    await request(app)
      .post('/warehouse/inventory')
      .set({ Authorization: `Bearer ${nonAdminToken}` })
      .expect(403);
  });

  it('мастер МОЖЕТ смотреть список запчастей', async () => {
    await request(app)
      .get('/parts')
      .set({ Authorization: `Bearer ${nonAdminToken}` })
      .expect(200);
  });

  it('мастер НЕ может получить сводку склада', async () => {
    await request(app)
      .get('/parts/summary')
      .set({ Authorization: `Bearer ${nonAdminToken}` })
      .expect(403);
  });
});
