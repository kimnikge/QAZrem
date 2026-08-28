-- Migration: гибкие права доступа (ТЗ Блоки 8.4 / 10)
-- Up

-- Права ролей: наличие строки = право выдано роли.
-- По умолчанию таблица пустая: как и раньше, всё, кроме чтения, доступно только admin.
CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL CHECK (role IN ('master', 'reception')),
  permission TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);

-- Индивидуальные переопределения прав для конкретных пользователей
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission)
);
