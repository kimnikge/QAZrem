-- Migration: cash accounts, payment splits, cash transfers
-- Up

-- Кассы компании
CREATE TABLE IF NOT EXISTS company_accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) DEFAULT 'cash',
  currency VARCHAR(10) DEFAULT 'KZT',
  balance DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

INSERT INTO company_accounts (name, type, sort_order) VALUES
  ('Наличные', 'cash', 1),
  ('Kaspi QR', 'kaspi', 2),
  ('Безнал', 'bank', 3);

-- Разбивка платежа по кассам
CREATE TABLE IF NOT EXISTS payment_splits (
  id SERIAL PRIMARY KEY,
  payment_id INT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES company_accounts(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Перемещения между кассами
CREATE TABLE IF NOT EXISTS cash_transfers (
  id SERIAL PRIMARY KEY,
  from_account_id INT NOT NULL REFERENCES company_accounts(id),
  to_account_id INT NOT NULL REFERENCES company_accounts(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  comment TEXT,
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down
-- DROP TABLE IF EXISTS cash_transfers;
-- DROP TABLE IF EXISTS payment_splits;
-- DROP TABLE IF EXISTS company_accounts;
