-- Migration: чистка legacy compatible_models
-- Down

ALTER TABLE parts ADD COLUMN IF NOT EXISTS compatible_models TEXT[] DEFAULT '{}';
