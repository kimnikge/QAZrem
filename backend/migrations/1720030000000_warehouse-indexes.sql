-- Migration: Warehouse indexes
-- Up

-- Поиск по категориям
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category_id);

-- Поиск по тегам
CREATE INDEX IF NOT EXISTS idx_part_tags_tag ON part_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_part_tags_part ON part_tags(part_id);

-- FIFO: быстрый поиск старейшей партии с остатком
CREATE INDEX IF NOT EXISTS idx_batches_fifo ON part_batches(part_id, received_at)
  WHERE current_quantity > 0;

-- Сквозной поиск (trigram)
CREATE INDEX IF NOT EXISTS idx_parts_name_trgm ON parts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parts_sku_trgm ON parts USING gin (sku gin_trgm_ops);

-- JSONB-индекс для поиска по атрибутам
CREATE INDEX IF NOT EXISTS idx_parts_attributes ON parts USING gin (attributes);

-- Инвентаризация
CREATE INDEX IF NOT EXISTS idx_inventory_sheets_status ON inventory_sheets(status);

-- Резервы
CREATE INDEX IF NOT EXISTS idx_reservations_order ON reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
