-- Migration: Add locations table and location_id to orders
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed two default locations
INSERT INTO locations (name, address) VALUES
  ('Сервисный центр №1', 'Рыскулова 5'),
  ('Сервисный центр №2', 'ул. Толе би, 59')
ON CONFLICT DO NOTHING;

-- Add location_id to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
