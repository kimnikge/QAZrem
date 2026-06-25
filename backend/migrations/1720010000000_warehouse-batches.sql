-- Migration: Warehouse batches and FIFO
-- Up

-- ============================================================
-- 2.1 Партии
-- ============================================================
CREATE TABLE IF NOT EXISTS part_batches (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id),
  batch_number VARCHAR(100) NOT NULL,
  supplier_id INT NOT NULL REFERENCES suppliers(id),
  purchase_price DECIMAL(10,2) NOT NULL,
  initial_quantity INT NOT NULL CHECK (initial_quantity > 0),
  current_quantity INT NOT NULL CHECK (current_quantity >= 0),
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_warranty_months INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(part_id, batch_number)
);

-- ============================================================
-- 2.2 Расширяем part_movements
-- ============================================================
ALTER TABLE part_movements
  ADD COLUMN IF NOT EXISTS batch_id INT REFERENCES part_batches(id),
  ADD COLUMN IF NOT EXISTS location_id INT REFERENCES locations(id);

-- ============================================================
-- 2.3 Новые типы движений (6 вместо 3)
-- ============================================================
ALTER TABLE part_movements ALTER COLUMN type TYPE VARCHAR(20);
ALTER TABLE part_movements DROP CONSTRAINT IF EXISTS part_movements_type_check;
ALTER TABLE part_movements ADD CONSTRAINT part_movements_type_check
  CHECK (type IN (
    'incoming',        -- оприходование
    'outgoing',        -- списание на заказ
    'writeoff',        -- списание брак/потеря
    'return_order',    -- возврат с заказа
    'return_supplier', -- возврат поставщику
    'correction'       -- корректировка
  ));

-- ============================================================
-- 2.4 batch_id в order_parts (опционально для старых записей)
-- ============================================================
ALTER TABLE order_parts
  ADD COLUMN IF NOT EXISTS batch_id INT REFERENCES part_batches(id);

-- ============================================================
-- 2.5 Партия-заглушка для существующих остатков
-- ============================================================

-- Сначала создаём поставщика-заглушку, если поставщиков нет
INSERT INTO suppliers (name, notes)
SELECT 'Неизвестный поставщик (миграция)', 'Автосоздан для LEGACY-партий'
WHERE NOT EXISTS (SELECT 1 FROM suppliers);

-- Создаём LEGACY-партии для всех запчастей с остатком
INSERT INTO part_batches (part_id, batch_number, supplier_id, purchase_price,
                           initial_quantity, current_quantity, received_at)
SELECT
  p.id,
  'LEGACY-' || p.id,
  (SELECT id FROM suppliers ORDER BY id LIMIT 1),
  p.purchase_price,
  p.quantity,
  p.quantity,
  NOW()
FROM parts p
WHERE p.quantity > 0
  AND NOT EXISTS (SELECT 1 FROM part_batches pb WHERE pb.part_id = p.id);
