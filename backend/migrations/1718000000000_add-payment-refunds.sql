-- Migration: Add refund fields to payments
-- Up

ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reason VARCHAR(500);
