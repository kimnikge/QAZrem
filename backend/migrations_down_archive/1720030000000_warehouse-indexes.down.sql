-- Migration: Warehouse indexes — rollback
-- Down

DROP INDEX IF EXISTS idx_reservations_status;
DROP INDEX IF EXISTS idx_reservations_order;
DROP INDEX IF EXISTS idx_inventory_sheets_status;
DROP INDEX IF EXISTS idx_parts_attributes;
DROP INDEX IF EXISTS idx_parts_sku_trgm;
DROP INDEX IF EXISTS idx_parts_name_trgm;
DROP INDEX IF EXISTS idx_batches_fifo;
DROP INDEX IF EXISTS idx_part_tags_part;
DROP INDEX IF EXISTS idx_part_tags_tag;
DROP INDEX IF EXISTS idx_parts_category;
