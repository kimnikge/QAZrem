-- Migration: Add services table
-- Up

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  master_commission_pct INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction: order <-> services (какие услуги добавлены в заказ)
CREATE TABLE IF NOT EXISTS order_services (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_moment DECIMAL(12,2) NOT NULL,
  master_commission_pct_at_moment INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_services_order ON order_services(order_id);
CREATE INDEX IF NOT EXISTS idx_order_services_service ON order_services(service_id);
