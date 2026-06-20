-- Migration: add suppliers table and link to part_movements
-- Down

DROP INDEX IF EXISTS idx_part_movements_supplier;

ALTER TABLE part_movements
  DROP COLUMN IF EXISTS batch_number,
  DROP COLUMN IF EXISTS supplier_sku,
  DROP COLUMN IF EXISTS supplier_id;

DROP TABLE IF EXISTS suppliers CASCADE;
