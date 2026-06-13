-- Migration: Add group_name to device_catalog
ALTER TABLE device_catalog
ADD COLUMN IF NOT EXISTS group_name VARCHAR(100);

-- Update existing seed data with groups
UPDATE device_catalog SET group_name = 'Мобильный телефон' WHERE brand IN ('Apple', 'Samsung', 'Xiaomi', 'Redmi', 'Poco', 'Huawei', 'Honor', 'OnePlus', 'Google');
UPDATE device_catalog SET group_name = 'Планшет' WHERE model LIKE 'iPad%';
UPDATE device_catalog SET group_name = 'Смарт часы' WHERE model LIKE 'Watch%' OR model LIKE 'band%';
