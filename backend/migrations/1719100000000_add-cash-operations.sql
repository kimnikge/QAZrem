-- Migration: cash operations (manual income/expense for cash registers)
-- Up

CREATE TABLE IF NOT EXISTS cash_operations (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES company_accounts(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_operations_account_id_idx ON cash_operations(account_id);
CREATE INDEX IF NOT EXISTS cash_operations_created_at_idx ON cash_operations(created_at);

-- Down
-- DROP TABLE IF EXISTS cash_operations;
