-- Migration: M2M — запчасть в нескольких категориях (ТЗ Блок 1.4)
-- Up

-- ============================================================
-- Связь «запчасть ↔ категория» (многие-ко-многим)
-- ============================================================
CREATE TABLE IF NOT EXISTS part_category_links (
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES part_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (part_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_pcl_category ON part_category_links(category_id);
CREATE INDEX IF NOT EXISTS idx_pcl_part ON part_category_links(part_id);

-- ============================================================
-- Перенос существующих одиночных категорий в связи (как основные)
-- parts.category_id остаётся для обратной совместимости
-- ============================================================
INSERT INTO part_category_links (part_id, category_id, is_primary)
SELECT id, category_id, TRUE
FROM parts
WHERE category_id IS NOT NULL
ON CONFLICT (part_id, category_id) DO NOTHING;
