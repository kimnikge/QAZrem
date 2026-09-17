-- Migration: parts.quantity — производная от SUM(part_batches.current_quantity)
-- Up

CREATE OR REPLACE FUNCTION sync_parts_quantity() RETURNS trigger AS $$
DECLARE
  pid INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.part_id;
  ELSE
    pid := NEW.part_id;
  END IF;

  UPDATE parts
  SET quantity = COALESCE((
    SELECT SUM(pb.current_quantity)
    FROM part_batches pb
    WHERE pb.part_id = pid
  ), 0)
  WHERE parts.id = pid;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batches_sync_quantity ON part_batches;
CREATE TRIGGER trg_batches_sync_quantity
AFTER INSERT OR UPDATE OF current_quantity OR DELETE ON part_batches
FOR EACH ROW EXECUTE FUNCTION sync_parts_quantity();
