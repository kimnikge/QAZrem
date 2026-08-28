-- Migration: Перемещение запчастей между локациями
-- Down

DROP TABLE IF EXISTS part_locations CASCADE;

ALTER TABLE part_movements DROP COLUMN IF EXISTS from_location_id;
ALTER TABLE part_movements DROP COLUMN IF EXISTS to_location_id;

ALTER TABLE part_movements DROP CONSTRAINT IF EXISTS part_movements_type_check;
ALTER TABLE part_movements ADD CONSTRAINT part_movements_type_check
  CHECK (type IN (
    'incoming', 'outgoing', 'writeoff', 'return_order', 'return_supplier',
    'correction'
  ));

-- Локацию «Общий склад (система)» не удаляем: на неё могут ссылаться другие данные.
