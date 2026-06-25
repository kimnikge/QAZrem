-- Migration: Warehouse foundation — categories, tags, attributes
-- Up

-- ============================================================
-- 1.1 Категории (иерархия через parent_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS part_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id INT REFERENCES part_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, parent_id)
);

-- ============================================================
-- 1.2 Шаблоны атрибутов для категорий
-- ============================================================
CREATE TABLE IF NOT EXISTS category_attributes (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES part_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  attr_type VARCHAR(20) NOT NULL DEFAULT 'string',  -- string/number/boolean/select
  attr_options JSONB,            -- для select: ["OLED","LCD","TFT"]
  sort_order INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- ============================================================
-- 1.3 Теги
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS part_tags (
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (part_id, tag_id)
);

-- ============================================================
-- 1.4 Расширяем parts
-- ============================================================
ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS category_id INT REFERENCES part_categories(id),
  ADD COLUMN IF NOT EXISTS model_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT 'шт',
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 1.5 Категория-заглушка для существующих запчастей
-- ============================================================
INSERT INTO part_categories (id, name) VALUES (1, 'Без категории')
ON CONFLICT (id) DO NOTHING;

UPDATE parts SET category_id = 1 WHERE category_id IS NULL;
