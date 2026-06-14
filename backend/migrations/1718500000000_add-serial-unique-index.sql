-- Migration: Add unique constraint and index on serial_number
-- Up

-- Удаляем дубликаты с пустым serial_number (NULL — допустим, несколько устройств могут не иметь серийника)
-- Если есть дубликаты с одинаковым НЕпустым serial_number — оставляем самое старое устройство
DELETE FROM devices
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY serial_number ORDER BY created_at ASC) AS rn
    FROM devices
    WHERE serial_number IS NOT NULL
  ) AS dupes
  WHERE rn > 1
);

-- Индекс для быстрого поиска по серийному номеру
CREATE INDEX IF NOT EXISTS idx_devices_serial_number ON devices(serial_number);

-- Уникальное ограничение: серийный номер уникален среди всех устройств
-- NULL значения не конфликтуют (PostgreSQL позволяет несколько NULL в UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_serial_number_unique ON devices(serial_number) WHERE serial_number IS NOT NULL;
