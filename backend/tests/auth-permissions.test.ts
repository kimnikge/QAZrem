/**
 * Интеграционные тесты: гибкие права доступа (ТЗ Блок 10, после доработки 6)
 * Запуск: npm test (из backend/)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { closePool, pool } from '../src/db/pool.js';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
  throw new Error('ADMIN_LOGIN и ADMIN_PASSWORD обязательны для тестов — задайте их в .env');
}
const ts = Date.now();

let adminToken = '';
let masterToken = '';
let masterId = 0;
let testPartId = 0;
let testSupplierId = 0;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function login(l: string, pw: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ login: l, password: pw }).expect(200);
  return res.body.token as string;
}

beforeAll(async () => {
  adminToken = await login(ADMIN_LOGIN, ADMIN_PASSWORD);

  // Уникальный мастер-фикстура
  const masterLogin = `perm_master_${ts}`;
  const reg = await request(app)
    .post('/auth/register')
    .set(auth(adminToken))
    .send({ name: 'Тест Права Мастер', login: masterLogin, password: 'test123456', role: 'master' })
    .expect(201);
  masterId = reg.body.user.id;
  masterToken = await login(masterLogin, 'test123456');

  // Запчасть-фикстура (без начального остатка)
  const part = await request(app)
    .post('/parts')
    .set(auth(adminToken))
    .send({ name: `TEST-права-${ts}`, purchase_price: 1500, selling_price: 3000 })
    .expect(201);
  testPartId = part.body.id;

  const sups = await request(app).get('/suppliers').set(auth(adminToken)).expect(200);
  testSupplierId = sups.body[0]?.id ?? 0;
});

afterAll(async () => {
  // Чистим только выданные нами права, чтобы не влиять на другие прогоны
  await pool.query(
    `DELETE FROM role_permissions
     WHERE role = 'master' AND permission IN ('parts.view_purchase_price', 'parts.receive', 'parts.writeoff')`,
  );
  await pool.query('DELETE FROM user_permission_overrides WHERE user_id = $1', [masterId]);
  await closePool();
});

describe('Гибкие права доступа (Блок 10)', () => {
  it('каталог прав доступен админу (5 прав)', async () => {
    const res = await request(app).get('/permissions').set(auth(adminToken)).expect(200);
    expect(res.body.permissions.length).toBe(5);
  });

  it('без права: оприходование запрещено мастеру', async () => {
    await request(app)
      .post('/parts/movement')
      .set(auth(masterToken))
      .send({ part_id: testPartId, quantity: 1, supplier_id: testSupplierId })
      .expect(403);
  });

  it('без права: мастер не видит закупочную цену', async () => {
    const res = await request(app).get(`/parts/${testPartId}`).set(auth(masterToken)).expect(200);
    expect(res.body.purchase_price).toBeNull();
  });

  it('GET /permissions/check → false', async () => {
    const res = await request(app)
      .get('/permissions/check?permission=parts.view_purchase_price')
      .set(auth(masterToken))
      .expect(200);
    expect(res.body.allowed).toBe(false);
  });

  it('админ выдаёт право роли «видеть закупочные цены»', async () => {
    await request(app)
      .put('/permissions')
      .set(auth(adminToken))
      .send({ role: 'master', permission: 'parts.view_purchase_price', allowed: true })
      .expect(200);

    const res = await request(app).get(`/parts/${testPartId}`).set(auth(masterToken)).expect(200);
    expect(res.body.purchase_price).not.toBeNull();
  });

  it('админ выдаёт индивидуальное право на оприходование', async () => {
    await request(app)
      .put('/permissions')
      .set(auth(adminToken))
      .send({ user_id: masterId, permission: 'parts.receive', allowed: true })
      .expect(200);

    await request(app)
      .post('/parts/movement')
      .set(auth(masterToken))
      .send({ part_id: testPartId, quantity: 3, supplier_id: testSupplierId, batch_number: `PERM-${ts}` })
      .expect(201);
  });

  it('индивидуальный запрет перекрывает право роли', async () => {
    await request(app)
      .put('/permissions')
      .set(auth(adminToken))
      .send({ user_id: masterId, permission: 'parts.view_purchase_price', allowed: false })
      .expect(200);

    const res = await request(app).get(`/parts/${testPartId}`).set(auth(masterToken)).expect(200);
    expect(res.body.purchase_price).toBeNull();
  });

  it('сброс переопределения возвращает право роли', async () => {
    await request(app)
      .delete(`/permissions/overrides/${masterId}/parts.view_purchase_price`)
      .set(auth(adminToken))
      .expect(200);

    const res = await request(app).get(`/parts/${testPartId}`).set(auth(masterToken)).expect(200);
    expect(res.body.purchase_price).not.toBeNull();
  });

  it('мастер без права не может списать брак', async () => {
    await request(app)
      .post('/parts/writeoff')
      .set(auth(masterToken))
      .send({ part_id: testPartId, quantity: 1 })
      .expect(403);
  });
});
