-- Migration: Add fields for ROAPP parity
-- Down

ALTER TABLE orders DROP COLUMN IF EXISTS deadline;
ALTER TABLE orders DROP COLUMN IF EXISTS status_deadline;
ALTER TABLE orders DROP COLUMN IF EXISTS estimated_cost;
ALTER TABLE orders DROP COLUMN IF EXISTS priority;
ALTER TABLE orders DROP COLUMN IF EXISTS source;
ALTER TABLE clients DROP COLUMN IF EXISTS address;
