-- Down: part-delete-cascade
ALTER TABLE part_batches DROP CONSTRAINT IF EXISTS part_batches_part_id_fkey;
ALTER TABLE part_batches ADD CONSTRAINT part_batches_part_id_fkey
  FOREIGN KEY (part_id) REFERENCES parts(id);

ALTER TABLE part_movements DROP CONSTRAINT IF EXISTS part_movements_part_id_fkey;
ALTER TABLE part_movements ADD CONSTRAINT part_movements_part_id_fkey
  FOREIGN KEY (part_id) REFERENCES parts(id);
