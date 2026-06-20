/**
 * Интеграционные тесты: полный сценарий заказа от создания до закрытия.
 * Особый фокус — работа с кассами (приход/расход/перемещение).
 *
 * Запуск: npm test (из backend/)
 * Требуется: .env с DATABASE_URL, тестовый админский аккаунт
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { closePool } from '../src/db/pool.js';

// ═══════════════════════════════════════════════════════════
// Константы
// ═══════════════════════════════════════════════════════════

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'MISTIK-XXX';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Detka0300304345';

let adminToken = '';
let receptionToken = '';
let masterToken = '';

const TEST_IMEI = `9${Date.now().toString().slice(-13)}`;

let orderId = 0;
let clientId = 0;
let deviceId = 0;
let partId = 0;
let serviceId = 0;
let paymentMethodId = 0;
let accountCashId = 0;
let accountKaspiId = 0;

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Логин и получение токена */
async function login(login: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/auth/login')
    .send({ login, password })
    .expect(200);
  return res.body.token;
}

// ═══════════════════════════════════════════════════════════
// Setup / Teardown
// ═══════════════════════════════════════════════════════════

beforeAll(async () => {
  // Получаем токены
  adminToken = await login(ADMIN_LOGIN, ADMIN_PASSWORD);

  // Создаём тестового приёмщика и мастера если нет
  try {
    await request(app)
      .post('/auth/register')
      .set(auth(adminToken))
      .send({ name: 'Тест Приёмщик', login: 'test_reception', password: 'test123456', role: 'reception' });
  } catch {}
  try {
    await request(app)
      .post('/auth/register')
      .set(auth(adminToken))
      .send({ name: 'Тест Мастер', login: 'test_master', password: 'test123456', role: 'master' });
  } catch {}

  receptionToken = await login('test_reception', 'test123456');
  masterToken = await login('test_master', 'test123456');

  // Получаем справочные данные
  const settings = await request(app).get('/settings').set(auth(adminToken)).expect(200);
  paymentMethodId = settings.body.payment_methods[0]?.id || 1;

  // Получаем кассы
  const accounts = await request(app).get('/accounts').set(auth(adminToken)).expect(200);
  accountCashId = accounts.body.find((a: any) => a.type === 'cash')?.id || 1;
  accountKaspiId = accounts.body.find((a: any) => a.type === 'kaspi')?.id || 2;
});

afterAll(async () => {
  await closePool();
});

// ═══════════════════════════════════════════════════════════
// ТЕСТЫ
// ═══════════════════════════════════════════════════════════

describe('Полный сценарий: заказ → кассы → закрытие', () => {

  // ─────────────────────────────────────────────────────
  // Этап 1: Создание заказа
  // ─────────────────────────────────────────────────────
  describe('Этап 1: Создание заказа', () => {
    it('создаёт заказ с новым клиентом и устройством', async () => {
      const res = await request(app)
        .post('/orders')
        .set(auth(receptionToken))
        .send({
          client: { name: 'Тестов Клиент', phone: '+77001234567' },
          device: { brand: 'iPhone', model: '15 Pro', imei: TEST_IMEI },
          issue_description: 'Не включается экран',
          source: 'instagram',
          priority: 'normal',
        })
        .expect(201);

      expect(res.body.id).toBeGreaterThan(0);
      orderId = res.body.id;
    });

    it('возвращает созданный заказ с деталями', async () => {
      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      expect(res.body.id).toBe(orderId);
      expect(res.body.client_name).toBe('Тестов Клиент');
      expect(res.body.brand).toBe('iPhone');
      expect(res.body.status_slug).toBe('new');
      expect(res.body.parts).toEqual([]);
      expect(res.body.services).toEqual([]);
      expect(Number(res.body.cost)).toBe(0);

      clientId = res.body.client_id;
      deviceId = res.body.device_id;
    });
  });

  // ─────────────────────────────────────────────────────
  // Этап 2: Диагностика
  // ─────────────────────────────────────────────────────
  describe('Этап 2: Перевод в диагностику', () => {
    it('меняет статус на diagnosis', async () => {
      await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(auth(masterToken))
        .send({ status_slug: 'diagnosis', comment: 'Начинаю диагностику' })
        .expect(200);
    });

    it('отображает статус diagnosis', async () => {
      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      expect(res.body.status_slug).toBe('diagnosis');
    });
  });

  // ─────────────────────────────────────────────────────
  // Этап 3: Добавление запчастей и услуг, проверка стоимости
  // ─────────────────────────────────────────────────────
  describe('Этап 3: Запчасти, услуги и пересчёт стоимости', () => {
    it('получает список запчастей и услуг', async () => {
      const parts = await request(app).get('/parts').set(auth(adminToken)).expect(200);
      const services = await request(app).get('/services').set(auth(adminToken)).expect(200);

      expect(parts.body.length).toBeGreaterThan(0);
      expect(services.body.length).toBeGreaterThan(0);

      // Берём первую запчасть с ненулевым остатком
      const p = parts.body.find((x: any) => x.quantity > 0);
      if (p) partId = p.id;

      // Берём первую услугу
      if (services.body.length > 0) serviceId = services.body[0].id;
    });

    it('добавляет запчасть к заказу и пересчитывает стоимость', async () => {
      if (!partId) return; // skip if no parts

      await request(app)
        .post(`/orders/${orderId}/parts`)
        .set(auth(masterToken))
        .send({ part_id: partId, quantity: 2 })
        .expect(200);

      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      expect(res.body.parts.length).toBeGreaterThanOrEqual(1);
      // Стоимость должна быть > 0 (selling_price × quantity)
      expect(Number(res.body.cost)).toBeGreaterThan(0);

      const part = res.body.parts.find((p: any) => p.part_name);
      expect(part).toBeDefined();
      expect(part.quantity_used).toBe(2);
    });

    it('добавляет услугу к заказу и увеличивает стоимость', async () => {
      if (!serviceId) return;

      const before = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);
      const costBefore = Number(before.body.cost);

      await request(app)
        .post(`/orders/${orderId}/services`)
        .set(auth(receptionToken))
        .send({ service_id: serviceId, quantity: 1 })
        .expect(201);

      const after = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      expect(after.body.services.length).toBeGreaterThanOrEqual(1);
      // Стоимость должна увеличиться
      expect(Number(after.body.cost)).toBeGreaterThan(costBefore);
    });

    it('удаляет запчасть и пересчитывает стоимость вниз', async () => {
      if (!partId) return;

      const before = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);
      const costBefore = Number(before.body.cost);
      const opId = before.body.parts[0]?.id;

      if (!opId) return;

      await request(app)
        .delete(`/orders/${orderId}/parts/${opId}`)
        .set(auth(adminToken))
        .expect(200);

      const after = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      // Стоимость должна уменьшиться
      expect(Number(after.body.cost)).toBeLessThan(costBefore);
    });

    it('добавляет запчасть обратно для дальнейших тестов', async () => {
      if (!partId) return;

      await request(app)
        .post(`/orders/${orderId}/parts`)
        .set(auth(masterToken))
        .send({ part_id: partId, quantity: 1 })
        .expect(200);
    });
  });

  // ─────────────────────────────────────────────────────
  // Этап 4: Кассовые операции (приход/расход/перемещение)
  // ─────────────────────────────────────────────────────
  describe('Этап 4: Кассы — приход, расход, перемещение', () => {
    it('получает список касс с балансами', async () => {
      const res = await request(app)
        .get('/accounts')
        .set(auth(adminToken))
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2);
      res.body.forEach((a: any) => {
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('name');
        expect(a).toHaveProperty('balance');
      });
    });

    it('вносит ручной ПРИХОД в кассу (оплата за консультацию)', async () => {
      const res = await request(app)
        .post(`/accounts/${accountCashId}/operations`)
        .set(auth(adminToken))
        .send({ type: 'income', amount: 5000, description: 'Оплата за консультацию' })
        .expect(201);

      expect(res.body.type).toBe('income');
      expect(Number(res.body.amount)).toBe(5000);
      expect(res.body.description).toBe('Оплата за консультацию');
    });

    it('отражает приход в истории кассы', async () => {
      const res = await request(app)
        .get(`/accounts/${accountCashId}/transactions`)
        .set(auth(adminToken))
        .expect(200);

      const manualIncomes = res.body.transactions.filter(
        (t: any) => t.type === 'manual_income'
      );
      expect(manualIncomes.length).toBeGreaterThanOrEqual(1);
      expect(manualIncomes[0].description).toContain('консультацию');
      expect(Number(manualIncomes[0].income)).toBe(5000);
    });

    it('делает ручной РАСХОД из кассы (ком. услуги)', async () => {
      // Сначала убедимся что баланса хватает
      const before = await request(app)
        .get('/accounts')
        .set(auth(adminToken))
        .expect(200);
      const cashBefore = before.body.find((a: any) => a.id === accountCashId);
      expect(Number(cashBefore.balance)).toBeGreaterThanOrEqual(3000);

      const res = await request(app)
        .post(`/accounts/${accountCashId}/operations`)
        .set(auth(adminToken))
        .send({ type: 'expense', amount: 3000, description: 'Ком. услуги за офис' })
        .expect(201);

      expect(res.body.type).toBe('expense');
      expect(Number(res.body.amount)).toBe(3000);
    });

    it('отражает расход в истории кассы и баланс уменьшился', async () => {
      const res = await request(app)
        .get(`/accounts/${accountCashId}/transactions`)
        .set(auth(adminToken))
        .expect(200);

      const manualExpenses = res.body.transactions.filter(
        (t: any) => t.type === 'manual_expense'
      );
      expect(manualExpenses.length).toBeGreaterThanOrEqual(1);

      // Проверяем, что баланс = сумма всех приходов - сумма всех расходов
      const lastTx = res.body.transactions[res.body.transactions.length - 1];
      const expectedBalance =
        res.body.transactions.reduce(
          (sum: number, t: any) => sum + Number(t.income) - Number(t.outcome),
          0
        );
      expect(Number(lastTx.balance)).toBe(expectedBalance);
    });

    it('НЕ даёт сделать расход больше баланса', async () => {
      const res = await request(app)
        .post(`/accounts/${accountCashId}/operations`)
        .set(auth(adminToken))
        .send({ type: 'expense', amount: 999999999, description: 'Невозможный расход' })
        .expect(400);

      expect(res.body.error).toContain('Недостаточно');
    });

    it('делает ПЕРЕМЕЩЕНИЕ между кассами', async () => {
      const res = await request(app)
        .post('/transfers')
        .set(auth(adminToken))
        .send({
          from_account_id: accountCashId,
          to_account_id: accountKaspiId,
          amount: 500,
          comment: 'Инкассация на Kaspi',
        })
        .expect(201);

      expect(res.body.from_account_id).toBe(accountCashId);
      expect(res.body.to_account_id).toBe(accountKaspiId);
      expect(Number(res.body.amount)).toBe(500);
    });

    it('НЕ даёт переместить больше баланса', async () => {
      const acc = await request(app)
        .get('/accounts')
        .set(auth(adminToken))
        .expect(200);
      const cashAcc = acc.body.find((a: any) => a.id === accountCashId);

      const res = await request(app)
        .post('/transfers')
        .set(auth(adminToken))
        .send({
          from_account_id: accountCashId,
          to_account_id: accountKaspiId,
          amount: Math.round(Number(cashAcc.balance) + 999999),
          comment: 'Слишком много',
        })
        .expect(400);

      expect(res.body.error).toContain('Недостаточно');
    });
  });

  // ─────────────────────────────────────────────────────
  // Этап 5: Оплата заказа с разбивкой по кассам
  // ─────────────────────────────────────────────────────
  describe('Этап 5: Оплата заказа', () => {
    let orderCost: number;
    let cashBalanceBefore: number;
    let kaspiBalanceBefore: number;

    it('переводит заказ в статус ready (готов к выдаче)', async () => {
      await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(auth(masterToken))
        .send({ status_slug: 'repair', comment: 'В ремонте' })
        .expect(200);

      await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(auth(masterToken))
        .send({ status_slug: 'ready', comment: 'Готово к выдаче' })
        .expect(200);

      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      expect(res.body.status_slug).toBe('ready');
      orderCost = Number(res.body.cost);
    });

    it('запоминает балансы касс до оплаты', async () => {
      const acc = await request(app)
        .get('/accounts')
        .set(auth(adminToken))
        .expect(200);

      cashBalanceBefore = Number(
        acc.body.find((a: any) => a.id === accountCashId).balance
      );
      kaspiBalanceBefore = Number(
        acc.body.find((a: any) => a.id === accountKaspiId).balance
      );
    });

    it('принимает оплату с разбивкой по кассам', async () => {
      const halfCost = Math.floor(orderCost / 2);
      const rest = orderCost - halfCost;

      const res = await request(app)
        .post('/payments')
        .set(auth(receptionToken))
        .send({
          order_id: orderId,
          amount: orderCost,
          payment_method_id: paymentMethodId,
          splits: [
            { account_id: accountCashId, amount: halfCost },
            { account_id: accountKaspiId, amount: rest },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeGreaterThan(0);
    });

    it('балансы касс увеличились на суммы сплитов', async () => {
      const acc = await request(app)
        .get('/accounts')
        .set(auth(adminToken))
        .expect(200);

      const cashAfter = Number(
        acc.body.find((a: any) => a.id === accountCashId).balance
      );
      const kaspiAfter = Number(
        acc.body.find((a: any) => a.id === accountKaspiId).balance
      );

      expect(cashAfter).toBeGreaterThan(cashBalanceBefore);
      expect(kaspiAfter).toBeGreaterThan(kaspiBalanceBefore);
    });

    it('видит платёж в деталях заказа со сплитами', async () => {
      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      expect(res.body.payments.length).toBeGreaterThanOrEqual(1);
      const payment = res.body.payments[0];
      expect(payment.splits).toBeDefined();
      expect(payment.splits.length).toBe(2);
    });

    it('видит платёж в истории кассовых операций', async () => {
      const res = await request(app)
        .get(`/accounts/${accountCashId}/transactions`)
        .set(auth(adminToken))
        .expect(200);

      const paymentTx = res.body.transactions.find(
        (t: any) => t.type === 'payment'
      );
      expect(paymentTx).toBeDefined();
      expect(Number(paymentTx.income)).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // Этап 6: Завершение заказа
  // ─────────────────────────────────────────────────────
  describe('Этап 6: Завершение заказа', () => {
    it('меняет статус на completed', async () => {
      await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(auth(adminToken))
        .send({ status_slug: 'completed', comment: 'Клиент забрал устройство' })
        .expect(200);

      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set(auth(receptionToken))
        .expect(200);

      expect(res.body.status_slug).toBe('completed');
      expect(res.body.completed_at).not.toBeNull();
    });

    it('НЕ даёт добавить запчасть в завершённый заказ', async () => {
      if (!partId) return;

      await request(app)
        .post(`/orders/${orderId}/parts`)
        .set(auth(masterToken))
        .send({ part_id: partId, quantity: 1 })
        .expect(400);
    });

    it('НЕ даёт принять платёж по завершённому заказу', async () => {
      await request(app)
        .post('/payments')
        .set(auth(receptionToken))
        .send({
          order_id: orderId,
          amount: 1000,
          payment_method_id: paymentMethodId,
        })
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────
  // Этап 7: Проверка истории касс после всего сценария
  // ─────────────────────────────────────────────────────
  describe('Этап 7: Итоговая проверка касс', () => {
    it('история кассы содержит все типы операций', async () => {
      const res = await request(app)
        .get(`/accounts/${accountCashId}/transactions`)
        .set(auth(adminToken))
        .expect(200);

      const types = new Set(res.body.transactions.map((t: any) => t.type));
      // Должны быть: manual_income, manual_expense, transfer_in или transfer_out, payment
      expect(types.has('manual_income')).toBe(true);
      expect(types.has('manual_expense')).toBe(true);
      expect(types.has('payment') || types.has('transfer_in') || types.has('transfer_out')).toBe(true);
    });

    it('running balance сходится (сумма приходов − сумма расходов = последний баланс)', async () => {
      const res = await request(app)
        .get(`/accounts/${accountCashId}/transactions`)
        .set(auth(adminToken))
        .expect(200);

      const txs = res.body.transactions;
      if (txs.length === 0) return;

      const computed = txs.reduce(
        (sum: number, t: any) => sum + Number(t.income) - Number(t.outcome),
        0
      );
      const lastBalance = Number(txs[txs.length - 1].balance);

      expect(computed).toBe(lastBalance);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Краевые тесты: валидация и ошибки
// ═══════════════════════════════════════════════════════════

describe('Валидация и обработка ошибок', () => {
  it('401 при запросе без токена', async () => {
    await request(app).get('/orders').expect(401);
  });

  it('403 при попытке создать кассу не-админом', async () => {
    await request(app)
      .post('/accounts')
      .set(auth(receptionToken))
      .send({ name: 'Нелегальная касса' })
      .expect(403);
  });

  it('400 при отрицательной сумме прихода', async () => {
    await request(app)
      .post(`/accounts/${accountCashId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'income', amount: -100 })
      .expect(400);
  });

  it('400 при нулевой сумме расхода', async () => {
    await request(app)
      .post(`/accounts/${accountCashId}/operations`)
      .set(auth(adminToken))
      .send({ type: 'expense', amount: 0 })
      .expect(400);
  });

  it('404 при запросе несуществующей кассы', async () => {
    await request(app)
      .get('/accounts/99999/transactions')
      .set(auth(adminToken))
      .expect(404);
  });

  it('400 при перемещении в ту же кассу', async () => {
    await request(app)
      .post('/transfers')
      .set(auth(adminToken))
      .send({
        from_account_id: accountCashId,
        to_account_id: accountCashId,
        amount: 100,
      })
      .expect(400);
  });
});
