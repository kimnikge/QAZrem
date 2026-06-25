-- Migration: Warehouse operations — reservations, inventory, equipment
-- Up

-- ============================================================
-- 3.1 Резервирование
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id),
  batch_id INT REFERENCES part_batches(id),
  order_id INT NOT NULL REFERENCES orders(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  reserved_by INT NOT NULL REFERENCES users(id),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'cancelled'))
);

-- ============================================================
-- 3.2 Инвентаризация
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_sheets (
  id SERIAL PRIMARY KEY,
  location_id INT REFERENCES locations(id),
  created_by INT NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  sheet_id INT NOT NULL REFERENCES inventory_sheets(id) ON DELETE CASCADE,
  part_id INT NOT NULL REFERENCES parts(id),
  expected_quantity INT NOT NULL,
  actual_quantity INT,
  notes TEXT
);

-- ============================================================
-- 3.3 Оборудование мастеров
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  master_id INT NOT NULL REFERENCES users(id),
  quantity INT NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
