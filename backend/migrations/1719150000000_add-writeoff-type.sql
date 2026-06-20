-- Migration: add 'writeoff' type to part_movements CHECK constraint
-- Up

ALTER TABLE part_movements DROP CONSTRAINT IF EXISTS part_movements_type_check;
ALTER TABLE part_movements ADD CONSTRAINT part_movements_type_check CHECK (type IN ('incoming', 'outgoing', 'writeoff'));

-- Down
-- ALTER TABLE part_movements DROP CONSTRAINT part_movements_type_check;
-- ALTER TABLE part_movements ADD CONSTRAINT part_movements_type_check CHECK (type IN ('incoming', 'outgoing'));
