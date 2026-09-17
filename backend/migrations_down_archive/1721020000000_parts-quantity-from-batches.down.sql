-- Down: parts-quantity-from-batches
DROP TRIGGER IF EXISTS trg_batches_sync_quantity ON part_batches;
DROP FUNCTION IF EXISTS sync_parts_quantity();
