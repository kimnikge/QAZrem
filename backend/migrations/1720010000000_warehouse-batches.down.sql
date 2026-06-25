-- Migration: Warehouse batches and FIFO — rollback
-- Down

ALTER TABLE order_parts DROP COLUMN IF EXISTS batch_id;

ALTER TABLE part_movements DROP CONSTRAINT IF EXISTS part_movements_type_check;
ALTER TABLE part_movements ADD CONSTRAINT part_movements_type_check CHECK (type IN ('incoming', 'outgoing', 'writeoff'));
ALTER TABLE part_movements DROP COLUMN IF EXISTS location_id;
ALTER TABLE part_movements DROP COLUMN IF EXISTS batch_id;

DROP TABLE IF EXISTS part_batches;
