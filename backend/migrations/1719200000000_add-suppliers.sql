-- Migration: add suppliers table and link to part_movements
-- Up

-- ============================================================
-- Поставщики (suppliers)
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Добавляем поля в part_movements для учёта поставщика
-- ============================================================
ALTER TABLE part_movements
  ADD COLUMN IF NOT EXISTS supplier_id INT REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS supplier_sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_part_movements_supplier ON part_movements(supplier_id);
