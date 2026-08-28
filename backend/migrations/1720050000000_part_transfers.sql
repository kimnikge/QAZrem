-- Migration: Перемещение запчастей между локациями (ТЗ Блок 6.1)
-- Up

-- ============================================================
-- 1. Новый тип движения 'transfer'
-- ============================================================
ALTER TABLE part_movements DROP CONSTRAINT IF EXISTS part_movements_type_check;
ALTER TABLE part_movements ADD CONSTRAINT part_movements_type_check
  CHECK (type IN (
    'incoming',        -- оприходование
    'outgoing',        -- списание на заказ
    'writeoff',        -- списание брак/потеря
    'return_order',    -- возврат с заказа
    'return_supplier', -- возврат поставщику
    'correction',      -- корректировка
    'transfer'         -- перемещение между локациями
  ));

-- ============================================================
-- 2. Откуда/куда для перемещений
-- ============================================================
ALTER TABLE part_movements
  ADD COLUMN IF NOT EXISTS from_location_id INT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS to_location_id INT REFERENCES locations(id);

-- ============================================================
-- 3. Остатки по локациям
-- ============================================================
CREATE TABLE IF NOT EXISTS part_locations (
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (part_id, location_id)
);

-- ============================================================
-- 4. Системная локация «Общий склад» — туда переносим текущие остатки
-- ============================================================
INSERT INTO locations (name, address)
SELECT 'Общий склад (система)', 'Без привязки к филиалу'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Общий склад (система)');

INSERT INTO part_locations (part_id, location_id, quantity)
SELECT p.id, l.id, p.quantity
FROM parts p
JOIN locations l ON l.name = 'Общий склад (система)'
WHERE p.quantity > 0
ON CONFLICT (part_id, location_id) DO UPDATE
  SET quantity = part_locations.quantity + EXCLUDED.quantity;

CREATE INDEX IF NOT EXISTS idx_part_locations_location ON part_locations(location_id);
