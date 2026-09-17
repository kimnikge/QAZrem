-- Migration: parts.category_id — производная от part_category_links (триггер)
-- Up

CREATE OR REPLACE FUNCTION sync_parts_category_id() RETURNS trigger AS $$
DECLARE
  pid INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.part_id;
  ELSE
    pid := NEW.part_id;
  END IF;

  UPDATE parts
  SET category_id = (
    SELECT pcl.category_id
    FROM part_category_links pcl
    WHERE pcl.part_id = pid AND pcl.is_primary = TRUE
    LIMIT 1
  )
  WHERE parts.id = pid;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pcl_sync_category ON part_category_links;
CREATE TRIGGER trg_pcl_sync_category
AFTER INSERT OR UPDATE OF is_primary OR DELETE ON part_category_links
FOR EACH ROW EXECUTE FUNCTION sync_parts_category_id();
