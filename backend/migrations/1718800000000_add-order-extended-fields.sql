-- Migration: add extended order fields (password, face_id, completeness, condition, appearance, manager_notes, order_type)
-- Up

ALTER TABLE orders ADD COLUMN IF NOT EXISTS password VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS face_id BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completeness TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS condition VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS appearance TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manager_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'paid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Down
-- ALTER TABLE orders DROP COLUMN IF EXISTS password;
-- ALTER TABLE orders DROP COLUMN IF EXISTS face_id;
-- ALTER TABLE orders DROP COLUMN IF EXISTS completeness;
-- ALTER TABLE orders DROP COLUMN IF EXISTS condition;
-- ALTER TABLE orders DROP COLUMN IF EXISTS appearance;
-- ALTER TABLE orders DROP COLUMN IF EXISTS manager_notes;
-- ALTER TABLE orders DROP COLUMN IF EXISTS order_type;
