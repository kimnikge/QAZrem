-- Migration: Add order_groups table
-- Down

ALTER TABLE orders DROP COLUMN IF EXISTS group_id;
DROP TABLE IF EXISTS order_groups;
