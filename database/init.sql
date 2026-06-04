CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS repair_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  device_type TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_master TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repair_requests_status_idx ON repair_requests(status);
CREATE INDEX IF NOT EXISTS repair_requests_created_at_idx ON repair_requests(created_at DESC);
