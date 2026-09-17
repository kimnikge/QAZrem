-- Down: add-order-created-by
DROP INDEX IF EXISTS idx_orders_created_by;
ALTER TABLE orders DROP COLUMN IF EXISTS created_by;
