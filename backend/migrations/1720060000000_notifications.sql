-- Migration: уведомления по складу (ТЗ Блок 11)
-- Up

-- Справочник типов уведомлений
CREATE TABLE IF NOT EXISTS notification_types (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT
);

-- Настройки получателей: кто и через какой канал получает конкретный тип
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_code TEXT NOT NULL REFERENCES notification_types(code) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel IN ('telegram', 'whatsapp', 'app')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, type_code)
);

-- Лента событий
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  type_code TEXT NOT NULL REFERENCES notification_types(code),
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

INSERT INTO notification_types (code, title) VALUES
  ('low_stock', 'Низкий остаток'),
  ('zero_stock', 'Нулевой остаток'),
  ('stale', 'Залежавшиеся запчасти'),
  ('return_order', 'Возврат с заказа'),
  ('incoming', 'Поступление партии'),
  ('inventory', 'Расхождения инвентаризации'),
  ('return_supplier', 'Возврат поставщику'),
  ('reservation_cancelled', 'Снятие с резерва')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type_code);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
