-- Migration: Create all tables for QAZRem CRM
-- Up

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 2.11 Пользователи (users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'master', 'reception')),
  login VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2.4 Справочник статусов (order_statuses)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_statuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  is_final BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO order_statuses (name, slug, "order", is_final) VALUES
  ('Новая заявка', 'new', 10, FALSE),
  ('Диагностика', 'diagnosis', 20, FALSE),
  ('Ожидание запчасти', 'waiting_parts', 30, FALSE),
  ('Ремонт', 'repair', 40, FALSE),
  ('Готов к выдаче', 'ready', 50, FALSE),
  ('Выдан', 'completed', 60, TRUE),
  ('Отказ от ремонта', 'cancelled', 70, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2.1 Клиент (clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ============================================================
-- 2.2 Устройство (devices)
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  imei VARCHAR(20) UNIQUE NOT NULL,
  serial_number VARCHAR(50),
  color VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_client_id ON devices(client_id);

-- ============================================================
-- 2.3 Заказ (orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  device_id INT NOT NULL REFERENCES devices(id),
  master_id INT REFERENCES users(id),
  status_id INT NOT NULL REFERENCES order_statuses(id) DEFAULT 1,
  issue_description TEXT NOT NULL,
  diagnosis TEXT,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  prepaid DECIMAL(10,2) NOT NULL DEFAULT 0,
  internal_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status_id);
CREATE INDEX IF NOT EXISTS idx_orders_master ON orders(master_id);
CREATE INDEX IF NOT EXISTS idx_orders_device ON orders(device_id);

-- ============================================================
-- 2.12 История изменений заказа (order_history)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_history (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  user_id INT REFERENCES users(id),
  from_status_id INT REFERENCES order_statuses(id),
  to_status_id INT NOT NULL REFERENCES order_statuses(id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id);

-- ============================================================
-- 2.5 Запчасть (parts)
-- ============================================================
CREATE TABLE IF NOT EXISTS parts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  compatible_models JSONB NOT NULL DEFAULT '[]',
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INT NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_parts_sku ON parts(sku);

-- ============================================================
-- 2.6 Расход запчасти на заказ (order_parts)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_parts (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  part_id INT NOT NULL REFERENCES parts(id),
  quantity_used INT NOT NULL CHECK (quantity_used > 0),
  purchase_price_at_moment DECIMAL(10,2) NOT NULL,
  selling_price_at_moment DECIMAL(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_parts_order ON order_parts(order_id);

-- ============================================================
-- 2.13 Движение запчастей (part_movements)
-- ============================================================
CREATE TABLE IF NOT EXISTS part_movements (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('incoming', 'outgoing')),
  quantity INT NOT NULL CHECK (quantity > 0),
  order_id INT REFERENCES orders(id),
  document VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_part_movements_part ON part_movements(part_id);

-- ============================================================
-- 2.8 Справочник способов оплаты (payment_methods)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO payment_methods (name) VALUES
  ('Наличные'),
  ('Карта (терминал)'),
  ('Перевод на карту')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2.7 Платёж клиента (payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method_id INT NOT NULL REFERENCES payment_methods(id),
  is_prepayment BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ============================================================
-- 2.10 Категории расходов (expense_categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO expense_categories (name) VALUES
  ('Закупка запчастей'),
  ('Зарплата мастера'),
  ('Аренда'),
  ('Прочее')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2.9 Расходы (expenses)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES expense_categories(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  order_id INT REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- Индексы для универсального поиска
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING gin (name gin_trgm_ops);
