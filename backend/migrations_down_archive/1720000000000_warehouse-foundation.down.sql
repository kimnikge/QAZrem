-- Migration: Warehouse foundation — rollback
-- Down

ALTER TABLE parts
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS photo_url,
  DROP COLUMN IF EXISTS unit,
  DROP COLUMN IF EXISTS attributes,
  DROP COLUMN IF EXISTS model_name,
  DROP COLUMN IF EXISTS category_id;

DROP TABLE IF EXISTS part_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS category_attributes;
DROP TABLE IF EXISTS part_categories;
