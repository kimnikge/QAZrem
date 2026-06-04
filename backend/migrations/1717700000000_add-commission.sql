-- Migration: Add master commission to orders
-- Up

ALTER TABLE orders ADD COLUMN IF NOT EXISTS master_commission_pct DECIMAL(5,2) NOT NULL DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_commission_pct DECIMAL(5,2) NOT NULL DEFAULT 50;
