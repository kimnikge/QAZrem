-- Migration: Add unique constraint and index on serial_number
-- Down

DROP INDEX IF EXISTS idx_devices_serial_number_unique;
DROP INDEX IF EXISTS idx_devices_serial_number;
