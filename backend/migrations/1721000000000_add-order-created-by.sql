-- Migration: заказ хранит создателя (created_by) вместо LATERAL-поиска в истории
-- Up

ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);

-- Заполняем по первой записи истории (from_status_id IS NULL = создание заказа)
UPDATE orders o
SET created_by = (
  SELECT uh.user_id
  FROM order_history uh
  WHERE uh.order_id = o.id AND uh.from_status_id IS NULL
  ORDER BY uh.created_at
  LIMIT 1
)
WHERE o.created_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
