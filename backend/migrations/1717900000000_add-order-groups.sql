-- Migration: Add order_groups table
-- Up

CREATE TABLE IF NOT EXISTS order_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Добавляем group_id в orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_id INT REFERENCES order_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_group ON orders(group_id);
