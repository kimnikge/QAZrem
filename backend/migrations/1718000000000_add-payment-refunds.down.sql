-- Migration: Add refund fields to payments
-- Down

ALTER TABLE payments DROP COLUMN IF EXISTS refund_reason;
ALTER TABLE payments DROP COLUMN IF EXISTS refunded_at;
