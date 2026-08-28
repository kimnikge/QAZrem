-- Down
ALTER TABLE orders DROP COLUMN IF EXISTS master_commission_pct;
ALTER TABLE users DROP COLUMN IF EXISTS default_commission_pct;
