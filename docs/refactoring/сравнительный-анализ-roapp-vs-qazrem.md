# Сравнительный анализ ROApp vs QAZRem

> Дата: 20.06.2026
> Основание: полный обход RO App (https://web.roapp.io) и анализ текущей кодовой базы QAZRem

---

## 🗂️ Структура разделов (навигация)

| Раздел | ROApp URL | QAZRem | Статус |
|--------|-----------|--------|--------|
| **Заказы** | `/orders` | `/` (DashboardPage) | 🟡 Частично |
| **Кассы и оплата** | `/invoices` (ROApp) | —, своя логика | 🔴 Нет |
| **Финансы** | `/payments` | `/finance` | 🟡 Частично |
| **Склады** | `/warehouse` | `/parts` | 🔴 Минимально |
| **Контакты** | `/contacts` | Внутри заказа | 🟡 Частично |
| **Отчеты** | `/reports` | `/analytics` | 🟡 Частично |
| **Настройки** | `/settings` (21 раздел) | `/settings` (7 вкладок) | 🟡 Частично |

---

## 📋 1. Заказы — центральный раздел

### Текущая реализация QAZRem

**БД:** таблицы `orders`, `order_statuses`, `order_parts`, `order_history`, `order_groups`

```sql
orders (
  id, device_id FK, master_id FK, status_id FK,
  issue_description, diagnosis, cost, prepaid, discount,
  estimated_cost, internal_comment, deadline, priority, source,
  master_commission_pct, group_id FK, location_id FK,
  created_by, created_at, completed_at, status_deadline
)
```

**API:** `backend/src/routes/orders.ts`
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/orders` | Список (`?status=&master_id=&search=&overdue=&my=&group_id=&limit=&offset=`) |
| `POST` | `/orders` | Создать (с новым или существующим устройством) |
| `GET` | `/orders/:id` | Детали заказа |
| `PATCH` | `/orders/:id` | Обновить поля |
| `PATCH` | `/orders/:id/status` | Сменить статус |
| `POST` | `/orders/:id/parts` | Назначить запчасти |

**Фронтенд:** `DashboardPage` (доска + таблица), `CreateOrderPage`, `OrderDetailPage`
**Компоненты:** `BoardView`, `DashboardTable`, `OrderModal`, `OrderInfoCard`, `OrderPaymentsCard`, `OrderPartsSection`

### 1.1 Представления

| Функция | ROApp | QAZRem | Оценка |
|---------|-------|--------|--------|
| Доска (канбан) | ✅ По умолчанию, drag-and-drop | ✅ BoardView | 🟢 Готово |
| Таблица | ✅ Настраиваемые колонки, drag-columns | ✅ DashboardTable с настройкой колонок | 🟢 Готово |
| Быстрые фильтры (бренды) | ✅ Apple, Xiaomi, iMac, iPad... | ❌ | 🔴 Нет |
| Быстрые фильтры (мастера) | ✅ Ильяс, Абай, Аза... | ❌ | 🔴 Нет |
| Сводка сверху | ✅ «310 заказа Мои заказы», «50 Просроченные», «5.8M Ждут оплаты» | ✅ statCards (4 карточки) | 🟡 Упрощённо |

### 1.2 Колонки таблицы

| Колонка | ROApp | QAZRem |
|---------|-------|--------|
| Чекбокс (мультивыбор) | ✅ | ❌ |
| № заказа | ✅ C16375 | ✅ №{id} |
| Крайний срок | ✅ | ✅ |
| Статус (с выпадающим списком) | ✅ | ✅ |
| Создал | ✅ | ❌ (есть created_by_name в данных) |
| Изображение | ✅ | ❌ |
| Устройство + IMEI | ✅ | ✅ |
| Неисправность | ✅ | ✅ |
| Клиент (имя + телефон) | ✅ | ✅ |
| Итого | ✅ | ✅ |
| Гарантия/Уведомления | ✅ | ❌ |
| Рекламная кампания | ✅ | ❌ |
| Приоритет | ❌ (внутри карточки) | ✅ |

### 1.3 Расширенные фильтры

| Фильтр | ROApp | QAZRem |
|--------|-------|--------|
| Создано (период) | ✅ За всё время / месяц / произвольно | ❌ |
| Статус | ✅ | ✅ (через вкладки) |
| Тип (Платный/Гарантия) | ✅ | ❌ |
| Менеджер | ✅ | ❌ |
| Исполнитель | ✅ | ❌ |
| Группа | ✅ | ✅ (groupFilter) |
| Бренд | ✅ | ❌ |
| Модель | ✅ | ❌ |
| Тип клиента | ✅ | ❌ |
| Клиент | ✅ | ❌ |
| Плательщик | ✅ | ❌ |
| Статус счета | ✅ | ❌ |

### 1.4 Карточка заказа (создание/редактирование)

| Поле | ROApp | QAZRem |
|------|-------|--------|
| Клиент | ✅ | ✅ |
| Откуда узнали | ✅ (обязательное) | ✅ (source) |
| Устройство | ✅ | ✅ |
| Пароль устройства | ✅ | ❌ |
| Face ID | ✅ (чекбокс) | ❌ |
| Комплектация | ✅ (обязательное) | ❌ |
| Неисправность | ✅ (обязательное) | ✅ |
| Состояние (выпадающий список) | ✅ (13 вариантов) | ❌ |
| Особый внешний вид | ✅ | ❌ |
| Заметки менеджера | ✅ | ❌ |
| Срочно (флаг) | ✅ | ✅ (priority) |
| Тип (Платный/Гарантия) | ✅ | ❌ |
| Запчасти | ✅ | ✅ |
| Услуги/работы | ✅ | ✅ |
| Файлы/изображения | ✅ | ❌ |

### 1.5 Статусы заказов

| ROApp | QAZRem | Соответствие |
|-------|--------|-------------|
| Новый | new / Новая | ✅ |
| В работе | diagnosis → repair | 🟡 Разбито на 3 |
| — | waiting_parts | 🟡 Нет в ROApp (внутри «В работе») |
| Готов | ready | ✅ |
| Закрыт | completed | ✅ |
| — | cancelled / Отказ | 🟡 Нет в ROApp как отдельный |

**Вывод:** ROApp группирует статусы: «В работе» объединяет диагностику + ремонт + ожидание. QAZRem детальнее — каждый этап отдельно.

---

## 🧾 2. Кассы и оплата — пошаговая реализация

> В ROApp один платёж = одна касса. Наша логика: **один платёж можно разбить на несколько касс** + **перемещения между кассами с историей**.

```
Пример сплитования:
  Заказ на 100 000 ₸
  ├── Наличка ....... 30 000 ₸
  ├── Безнал ........ 30 000 ₸
  └── Kaspi QR ...... 40 000 ₸
```

---

### Шаг 0 — что должно получиться

```
Новые страницы:
  /finance              доработать — добавить вкладку «Кассы»
  /finance/accounts     список касс с балансами
  /finance/transfers    история перемещений

Новый UI:
  - Форма оплаты заказа: динамические строки «касса + сумма»
  - Форма перемещения: выбор откуда/куда + сумма

Новые таблицы БД:
  company_accounts     кассы
  payment_splits       разбивка одного платежа по кассам
  cash_transfers       перемещения между кассами
```

---

### Шаг 1 — миграция БД

Создать файл `backend/migrations/1719000000000_add-cash-accounts.sql`:

```sql
-- Кассы компании
CREATE TABLE IF NOT EXISTS company_accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,           -- Наличка, Безнал, Kaspi QR, Терминал...
  type VARCHAR(30) DEFAULT 'cash',      -- cash, bank, kaspi, terminal, virtual
  currency VARCHAR(10) DEFAULT 'KZT',
  balance DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- Сиды: три кассы по умолчанию
INSERT INTO company_accounts (name, type, sort_order) VALUES
  ('Наличные', 'cash', 1),
  ('Kaspi QR', 'kaspi', 2),
  ('Безнал', 'bank', 3);

-- Разбивка платежа по кассам
-- Один payment_id может иметь несколько записей в этой таблице
-- Сумма всех amount для одного payment_id = payments.amount
CREATE TABLE IF NOT EXISTS payment_splits (
  id SERIAL PRIMARY KEY,
  payment_id INT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES company_accounts(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Перемещения между кассами
CREATE TABLE IF NOT EXISTS cash_transfers (
  id SERIAL PRIMARY KEY,
  from_account_id INT NOT NULL REFERENCES company_accounts(id),
  to_account_id INT NOT NULL REFERENCES company_accounts(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  comment TEXT,
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Запустить миграцию:
```bash
cd backend && npm run migrate up
```

---

### Шаг 2 — бэкенд: роутер касс

Создать `backend/src/routes/accounts.ts`:

```
Методы:
  GET    /accounts              список всех касс (с балансом)
  POST   /accounts              создать кассу (admin)
  PATCH  /accounts/:id          переименовать/скрыть кассу
  GET    /accounts/:id/transactions   история операций по кассе
```

Логика `GET /accounts/:id/transactions`:
```sql
-- Собрать все движения по конкретной кассе:
-- 1. Приходы: payment_splits где account_id = :id
-- 2. Расходы/приходы: cash_transfers где from_account_id = :id (расход)
--    или to_account_id = :id (приход)
-- Объединить в одну ленту, отсортировать по дате
-- Для каждой записи вычислить нарастающий остаток (running balance)
```

**Валидация при создании платежа (добавить в `payments.ts`):**
```typescript
// При POST /payments с полем splits:
const createPaymentSchema = z.object({
  order_id: z.number().int().positive(),
  amount: z.number().positive(),
  payment_method_id: z.number().int().positive().optional(),
  splits: z.array(z.object({
    account_id: z.number().int().positive(),
    amount: z.number().positive()
  })).optional()
});

// Валидация в обработчике:
if (splits && splits.length > 0) {
  const splitsTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(splitsTotal - amount) > 0.01) {
    throw new BadRequestError(
      `Сумма разбивки (${splitsTotal}) не совпадает с суммой платежа (${amount})`
    );
  }
  // Записать каждый split в payment_splits
  // Обновить balance в company_accounts для каждого account_id
}
```

---

### Шаг 3 — бэкенд: роутер перемещений

Создать `backend/src/routes/transfers.ts`:

```
Методы:
  GET    /transfers             история всех перемещений
  POST   /transfers             выполнить перемещение
```

Логика `POST /transfers`:
```typescript
// Вход: { from_account_id, to_account_id, amount, comment }
// 1. Проверить что from != to
// 2. Проверить что баланс from_account >= amount
// 3. В транзакции:
//    - company_accounts: from.balance -= amount, to.balance += amount
//    - INSERT в cash_transfers
```

**Зарегистрировать новые роутеры в `app.ts`:**
```typescript
import { accountsRouter } from './routes/accounts.js';
import { transfersRouter } from './routes/transfers.js';
// ...
app.use('/accounts', requireAuth, accountsRouter);
app.use('/transfers', requireAuth, transfersRouter);
```

---

### Шаг 4 — бэкенд: обновить существующие роуты

**В `payments.ts`:**
- `POST /payments` — при создании принимать поле `splits` (массив), валидировать сумму, сохранять в `payment_splits`, обновлять балансы касс
- `GET /payments/:id` — возвращать вместе с платежом его `splits` (LEFT JOIN payment_splits)
- `POST /payments/:id/refund` — возврат: сторнировать балансы касс обратно

**В `finance.ts`:**
- `GET /finance/report` — учесть балансы касс в отчёте

---

### Шаг 5 — фронтенд: API-клиент

В `frontend/src/api.ts` (или новом файле `frontend/src/api/accounts.ts`) добавить:

```typescript
// Типы
export type CompanyAccount = {
  id: number; name: string; type: string;
  balance: string; is_active: boolean; sort_order: number;
};

export type PaymentSplit = {
  id: number; payment_id: number;
  account_id: number; amount: string;
};

export type CashTransfer = {
  id: number;
  from_account_id: number; from_account_name: string;
  to_account_id: number; to_account_name: string;
  amount: string; comment: string | null;
  created_by: number; created_by_name: string;
  created_at: string;
};

export type AccountTransaction = {
  date: string;
  type: 'payment' | 'transfer_in' | 'transfer_out';
  description: string;
  income: string;
  outcome: string;
  balance: string;  // нарастающий остаток
};

// Методы
getAccounts(): Promise<CompanyAccount[]>
createAccount(data): Promise<CompanyAccount>
updateAccount(id, data): Promise<CompanyAccount>
getAccountTransactions(id): Promise<AccountTransaction[]>
getTransfers(): Promise<CashTransfer[]>
createTransfer(data): Promise<CashTransfer>
```

**Обновить `createPayment`** — добавить поле `splits?: Array<{account_id: number, amount: number}>`.

---

### Шаг 6 — фронтенд: UI компоненты

**6a. Модифицировать `FinancePage.tsx`:**
- Добавить третью вкладку «Кассы»

**6b. Создать `frontend/src/components/CashAccountsTab.tsx`:**
- Карточки касс с балансом (как в ROApp: слева список счетов с суммами)
- Кнопка «+ Касса» (админ)
- Кнопка «Перемещение» → открывает модалку
- Клик по кассе → таблица истории операций (приход/расход/остаток)

**6c. Создать `frontend/src/components/CashTransferModal.tsx`:**
```
Форма:
  Откуда: [выпадающий список касс]  Баланс: 150 000
  Куда:   [выпадающий список касс]  Баланс: 200 000
  Сумма:  [_________]
  Комментарий: [_________]

  [Отмена]  [Переместить]
```

**6d. Модифицировать `OrderPaymentsCard.tsx` — форма приёма оплаты:**
```
Текущая форма (один платёж = одна сумма):
  Сумма: [_________]
  Способ: [Наличные ▼]
  [Добавить платёж]

Должна стать:
  Сумма к оплате: 100 000 ₸  (остаток по заказу)

  Разбивка по кассам:
  ┌─────────────────────────────────────┐
  │ Касса          │ Сумма        │     │
  │ [Наличка  ▼]   │ [ 30000 ]   │ [✕] │
  │ [Kaspi QR ▼]   │ [ 30000 ]   │ [✕] │
  │ [Безнал   ▼]   │ [ 40000 ]   │ [✕] │
  │ [+ Добавить кассу]                  │
  │                                     │
  │ Распределено: 100 000 / 100 000 ₸  │
  └─────────────────────────────────────┘

  [Сохранить платёж]
```

**Логика формы сплитования:**
1. По умолчанию одна строка с первой кассой на полную сумму
2. Кнопка «+ Добавить кассу» добавляет строку с суммой 0
3. При изменении любой суммы пересчитывается «Распределено»
4. Кнопка «Сохранить» неактивна пока распределено ≠ сумма к оплате
5. Каждая строка: выпадающий список касс + поле суммы + кнопка удалить (кроме последней)

---

### Шаг 7 — порядок действий при реализации

```
□ 1. Миграция: backend/migrations/1719000000000_add-cash-accounts.sql
□ 2. Запустить миграцию
□ 3. Бэкенд: backend/src/routes/accounts.ts (CRUD касс + история)
□ 4. Бэкенд: backend/src/routes/transfers.ts (перемещения)
□ 5. Бэкенд: зарегистрировать роутеры в app.ts
□ 6. Бэкенд: обновить payments.ts (splits при создании)
□ 7. Бэкенд: обновить GET /payments/:id (возвращать splits)
□ 8. Бэкенд: обновить POST /payments/:id/refund (сторно балансов)
□ 9. Фронтенд: типы и методы API
□ 10. Фронтенд: CashAccountsTab (карточки касс)
□ 11. Фронтенд: CashTransferModal (форма перемещения)
□ 12. Фронтенд: переделать OrderPaymentsCard (сплитование)
□ 13. Фронтенд: добавить вкладку «Кассы» в FinancePage
□ 14. Проверить: создать кассу, принять платёж со сплитом, переместить между кассами
```

---

### Шаг 8 — проверка (чек-лист)

```
□ Создал кассу «Наличка» — баланс 0
□ Создал заказ на 100 000
□ Принял платёж: Наличка 30 000 + Kaspi 30 000 + Безнал 40 000
□ Баланс Налички = 30 000, Kaspi = 30 000, Безнал = 40 000
□ История кассы «Наличка»: одна запись «Платёж заказа #N», приход 30 000, остаток 30 000
□ Переместил 20 000 из Налички в Безнал
□ Баланс Налички = 10 000, Безнал = 60 000
□ История Налички: платёж +30k, перемещение -20k, остаток 10k
□ История Безнала: платёж +40k, перемещение +20k, остаток 60k
□ Возврат платежа: балансы сторнированы обратно
```

---

## 💰 3. Финансы

### Текущая реализация QAZRem

**API:** `backend/src/routes/finance.ts`, `backend/src/routes/payments.ts`, `backend/src/routes/expenses.ts`

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/finance/report` | Отчёт о прибыли (`?from=&to=`) |
| `GET` | `/finance/report/export` | CSV-экспорт |
| `GET` | `/finance/payouts/:period` | Расчёт мастерам |
| `POST` | `/payments` | Создать платёж |
| `POST` | `/payments/:id/refund` | Возврат платежа |
| `GET` | `/expenses` | Список расходов |
| `POST` | `/expenses` | Создать расход |

**Фронтенд:** `FinancePage` — вкладки «Общий отчёт» и «Расчёт мастерам», `FinanceOverviewTab`, `FinancePayoutsTab`, `FinancePeriodSelector`

### Сравнительная таблица

| Функция | ROApp | QAZRem |
|---------|-------|--------|
| **Транзакции** (приход/расход/перемещение) | ✅ | 🟡 (только приход/расход через API) |
| **Несколько счетов** | ✅ (Kaspi ИП, безнал, нал, 9 счетов) | ❌ (единый учёт) |
| **Платёжные ссылки** | ✅ | ❌ |
| **Возвраты** | ✅ (отдельная вкладка) | 🟡 (в payments API) |
| **Взаиморасчёты** | ✅ (балансы контрагентов) | ❌ |
| **Расчёт зарплаты** | ✅ (ставка + бонусы − штрафы + премии) | 🟡 (только комиссия мастера) |
| **Начисления зарплаты** | ✅ (история начислений) | ❌ |
| **Теги транзакций** | ✅ | ❌ |
| **Остаток по счёту** | ✅ | ❌ |

### Ключевые доработки

**Несколько счетов компании:**
```sql
CREATE TABLE company_accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),  -- kaspi, bank, cash, virtual
  currency VARCHAR(10) DEFAULT 'KZT',
  is_active BOOLEAN DEFAULT true,
  balance DECIMAL(12,2) DEFAULT 0
);
```

**Зарплата — недостающие поля:** `users.default_hourly_rate`, таблица `salary_bonuses`, `salary_penalties`, `salary_accruals`.

---

## 🏭 4. Склады

### Текущая реализация QAZRem

**БД:** `parts (id, name, sku, compatible_models, purchase_price, selling_price, quantity, min_quantity)`, `part_movements (type, quantity, document, order_id)`

**API:** `backend/src/routes/parts.ts`
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/parts` | Список (`?low_stock=`) |
| `POST` | `/parts` | Создать |
| `PATCH` | `/parts/:id` | Обновить |
| `POST` | `/parts/receive` | Оприходование (приход) |
| `GET` | `/parts/movements` | История движений (`?part_id=&type=`) |
| `GET` | `/devices/catalog` | Поиск по каталогу устройств |

**Фронтенд:** `PartsPage` — таблица + модалки создания/редактирования/оприходования, `CatalogPage` — справочник брендов/моделей

### Сравнительная таблица

| Вкладка | ROApp | QAZRem |
|---------|-------|--------|
| **Остатки** | ✅ (артикул, кол-во, мин. остаток, 4 типа цен, гарантия, срок годности) | 🟡 `/parts` — только название, SKU, цена закупа/продажи, кол-во, мин. остаток |
| **Устройства** | ✅ (IMEI, владелец, склад, история обслуживания) | 🟡 `/catalog` — только бренд/модель (не экземпляры) |
| **Заказы поставщикам** | ✅ | ❌ |
| **Оприходования** | ✅ | 🟡 (есть receivePart) |
| **Резервирования** | ✅ | ❌ |
| **Конвертации** | ✅ | ❌ |
| **Перемещения** | ✅ | ❌ |
| **Инвентаризации** | ✅ | ❌ |
| **Списания** | ✅ | ❌ |
| **Возвраты** | ✅ | ❌ |
| **4 типа цен** | ✅ (Нулевая, Оптовикам, Ремонтная, Розничная) | 🟡 (только закупочная и продажная) |

### Ключевые доработки

**Таблица `price_types` и `part_prices`:**
```sql
CREATE TABLE price_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,  -- Нулевая, Оптовикам, Ремонтная, Розничная
  slug VARCHAR(30) UNIQUE
);

CREATE TABLE part_prices (
  part_id INT REFERENCES parts(id),
  price_type_id INT REFERENCES price_types(id),
  price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (part_id, price_type_id)
);
```

**Складские операции — недостающие таблицы:** `stock_receipts`, `stock_writeoffs`, `stock_transfers`, `stock_inventories`, `stock_reservations`.

---

### 🐛 Найдены баги — списание и отображение услуг/запчастей

#### Баг 1: Услуги не добавляются в заказ

**Таблица `order_services` существует в БД** (миграция `1718100000000_add-services.sql`), но:

| Проблема | Где |
|----------|-----|
| `POST /orders` не принимает поле `services` | `backend/src/routes/orders.ts` — только `parts` |
| `GET /orders/:id` не запрашивает `order_services` | только `order_parts` |
| Тип `OrderDetail` не содержит `services` | `frontend/src/api.ts` |
| На форме создания нет выбора услуг | `CreateOrderPage.tsx` — только вкладка «Запчасти» |
| В карточке заказа не показываются услуги | `OrderDetailPage.tsx` — только `order.parts` |

#### Баг 2: Запчасти/услуги не видны в карточке заказа при редактировании

`OrderDetailPage.tsx` — запчасти показываются только когда `!editing`. В режиме редактирования блок с запчастями исчезает.

#### Баг 3: Нет интерфейса добавления услуг к существующему заказу

Есть `POST /orders/:id/parts` и `DELETE /orders/:id/parts/:partId` для запчастей, но нет аналогичных эндпоинтов для услуг (`order_services`).

---

### 🔧 План исправления (5 шагов)

#### Шаг 1 — Бэкенд: добавить services в GET /orders/:id

В `backend/src/routes/orders.ts`, в обработчике `GET /:id` добавить запрос:

```sql
-- Услуги заказа
SELECT osrv.*, s.name AS service_name
FROM order_services osrv
JOIN services s ON s.id = osrv.service_id
WHERE osrv.order_id = $1
```

И включить в ответ: `services: servicesResult.rows`.

#### Шаг 2 — Бэкенд: эндпоинты для услуг заказа

Добавить в `orders.ts`:

```
POST   /orders/:id/services       — добавить услугу к заказу
DELETE /orders/:id/services/:sid  — убрать услугу из заказа
```

Логика `POST`:
1. Найти услугу в `services`, взять `price` и `master_commission_pct`
2. Вставить в `order_services` с `price_at_moment` и `master_commission_pct_at_moment`
3. Обновить `orders.cost += price` (опционально — или оставить ручной ввод стоимости)

Логика `DELETE`:
1. Найти запись в `order_services`
2. Вычесть `price_at_moment` из `orders.cost`
3. Удалить запись

#### Шаг 3 — Бэкенд: принимать services при создании заказа

В `POST /orders` добавить поле `services`:

```typescript
const orderServiceSchema = z.object({
  service_id: z.number().int().positive(),
  quantity: z.number().int().positive().default(1)
});

// В createOrderWithNewDeviceSchema / createOrderWithExistingDeviceSchema:
services: z.array(orderServiceSchema).optional()
```

В транзакции создания — после вставки заказа пройти по `services` и вставить в `order_services`.

#### Шаг 4 — Фронтенд: тип OrderDetail и API

В `frontend/src/api.ts`:

```typescript
export type OrderDetail = Order & {
  // ... существующие поля ...
  services: Array<{
    id: number;
    service_name: string;
    quantity: number;
    price_at_moment: string;
    master_commission_pct_at_moment: number;
  }>;
};

// Новые методы:
assignServiceToOrder(orderId: number, serviceId: number, quantity?: number)
deleteOrderService(orderId: number, serviceId: number)
```

#### Шаг 5 — Фронтенд: отображение услуг в заказе

**В `OrderDetailPage.tsx`:**
- Показывать `order.services` рядом с `order.parts` (и в режиме редактирования тоже!)
- Добавить кнопку «+ Услуга» для добавления к существующему заказу

**В `CreateOrderPage.tsx`:**
- Добавить вкладку «Услуги» рядом с «Запчасти» (или объединить в одну)
- Выпадающий список услуг + кнопка «Добавить»

**Как в ROApp:** запчасти и услуги отображаются в карточке заказа единым списком с названием, количеством и ценой.

---

## 👥 5. Контакты

### Текущая реализация QAZRem

**БД:** `clients (id, name, phone UNIQUE, email, total_spent, created_at)` — клиент создаётся вместе с заказом, отдельной страницы нет.

**API:** `backend/src/routes/clients.ts` — только поиск внутри `/search`

### Сравнительная таблица

| Функция | ROApp | QAZRem |
|---------|-------|--------|
| Список контактов (Люди) | ✅ | ❌ (только внутри заказа) |
| Организации | ✅ | ❌ |
| Расширенные фильтры | ✅ (12+ фильтров) | ❌ |
| Статистика по клиенту | ✅ (сумма заказов, кол-во, записи) | 🟡 (total_spent) |
| Запрет дубликатов | ✅ (настройка) | ❌ |
| Поле «Отчество» | ✅ (настройка) | ❌ |
| Согласие на уведомления | ✅ | ❌ |

### Спецификация для реализации

**Отдельная страница `/clients`:**
- Таблица: имя, телефон, email, всего потрачено, кол-во заказов, кол-во устройств
- Фильтры: по менеджеру, по дате последнего заказа, по сумме
- Клик → карточка клиента: контакты + список заказов + список устройств

**Доп. поля `clients`:** `patronymic VARCHAR(100)`, `consent_sms BOOLEAN DEFAULT true`, `consent_email BOOLEAN DEFAULT true`, `source VARCHAR(50)`, `manager_id INT REFERENCES users(id)`.

---

## 📊 6. Отчёты

### Текущая реализация QAZRem

**API:** аналитика только через `/orders` + `/finance/report` на клиенте.
**Фронтенд:** `AnalyticsPage` — группировка по мастерам, статусам, устройствам (период — текущий год, без экспорта).

### Сравнительная таблица

| Отчёт | ROApp | QAZRem |
|-------|-------|--------|
| Журнал событий | ✅ | ❌ |
| Финансы | ✅ | ❌ |
| Заказы (созданные/закрытые/в работе) | ✅ | ❌ |
| По мастерам | ✅ | 🟡 (аналитика) |
| По работам и услугам | ✅ | ❌ |
| Обращения | ✅ | ❌ |
| Склады | ✅ | ❌ |
| Маркетинг | ✅ | ❌ |
| Аналитический отчёт | ✅ | ❌ |
| Анализ ассортимента | ✅ | ❌ |

### Спецификация для реализации

**Новый роутер `backend/src/routes/reports.ts`:**
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/reports/masters` | Заказы/сумма/комиссия по мастерам (`?from=&to=`) |
| `GET` | `/reports/services` | Популярность услуг/работ |
| `GET` | `/reports/finance` | Приход/расход/прибыль по месяцам |
| `GET` | `/reports/orders` | Созданные/закрытые/в работе за период |
| `GET` | `/reports/events` | Журнал событий (из `order_history`) |

---

## ⚙️ 7. Настройки

### Текущая реализация QAZRem

**API:** `backend/src/routes/settings.ts`, `users.ts`, `locations.ts`, `order-groups.ts`, `print-templates.ts`, `services.ts`

**Фронтенд:** `SettingsPage` — 7 вкладок (пользователи, статусы read-only, способы оплаты, категории расходов, группы заказов, локации, шаблоны печати)

### Сравнительная таблица

| Раздел | ROApp | QAZRem |
|--------|-------|--------|
| **Общие** (компания, регион, валюта) | ✅ | 🟡 (settings API) |
| **Сотрудники** (роли, доступ) | ✅ | ✅ (users) |
| **Локации** | ✅ (4 локации) | ✅ |
| **Склады** | ✅ | ❌ |
| **Статусы** (настройка видимости по ролям) | ✅ | ❌ |
| **Внешние оповещения** | ✅ | ❌ |
| **Внутренние оповещения** | ✅ | ❌ |
| **Справочники** | ✅ | ❌ |
| **Редактор форм** | ✅ (drag-and-drop полей) | ❌ |
| **Шаблоны документов** | ✅ | 🟡 (print-templates) |
| **Публичные страницы** | ✅ | ❌ |
| **Финансы** (настройки счетов, валют) | ✅ | ❌ |
| **Цены и скидки** | ✅ | ❌ |
| **Маркетинг** | ✅ | ❌ |
| **Теги** | ✅ | ❌ |
| **Чаты** | ✅ | ❌ |
| **Телефония** | ✅ | ❌ |
| **Интеграции** | ✅ | ❌ |
| **API** | ✅ | ❌ |
| **Подписка** | ✅ | ❌ |
| **Реферальная программа** | ✅ | ❌ |

### Приоритетные настройки для реализации

1. **Общие** — логотип, описание компании, шаблоны номеров заказов/счетов
2. **Статусы** — CRUD + привязка к ролям (кто видит / кто ставит)
3. **Цены и скидки** — типы цен, скидки, наценки
4. **Внешние оповещения** — Telegram (уже частично), SMS, Email

---

## 📊 Сводная матрица готовности

| Модуль | Готовность | Оценка |
|--------|-----------|--------|
| Заказы (ядро) | 🟢 80% | Основной функционал есть, не хватает фильтров, доп. полей, изображений |
| Кассы и оплата | 🔴 0% | Нет сплитования и перемещений между кассами |
| Финансы | 🟡 40% | Есть базовый учёт, нет возвратов, зарплаты |
| Склады | 🟡 25% | Только список запчастей, нет складских операций |
| Контакты | 🟡 15% | Только внутри заказа |
| Отчёты | 🟡 20% | Базовая аналитика |
| Настройки | 🟡 25% | 7 из 21 раздела |
| **ОБЩАЯ** | **🟡 ~30%** | |

---

## 🎯 Приоритеты доработок

### 🔥 Критичные (немедленно)
1. **Расширенные фильтры в таблице заказов** — период, бренд, модель, менеджер, исполнитель, тип
2. **Быстрые чипсы** — бренды и мастера как в ROApp
3. **Сводка над таблицей** — «Мои заказы», «Просроченные», «Ждут оплаты»
4. **Дополнительные поля заказа** — комплектация, состояние, пароль, заметки менеджера, тип (платный/гарантия)

### 🟡 Высокий приоритет
5. **Контакты** — отдельная страница `/clients` с фильтрами и статистикой
6. **Отчёты** — по мастерам, по работам, финансовый (роутер `/reports`)
7. **Складские операции** — списания, перемещения, инвентаризации
8. **Изображения устройств** — загрузка и отображение в заказе

### 🟢 Средний приоритет
9. **Кассы и сплитование платежей** — несколько касс, разбивка оплаты, перемещения между кассами
10. **Расчёт зарплаты** — ставка + бонусы − штрафы + премии
11. **Возвраты** — отдельный интерфейс возврата платежей
12. **Статусы** — настройка видимости по ролям

### ⚪ Низкий приоритет
13. Редактор форм (drag-and-drop полей)
14. Публичные страницы, справочники, теги
15. Чаты, телефония, интеграции, API-ключи
