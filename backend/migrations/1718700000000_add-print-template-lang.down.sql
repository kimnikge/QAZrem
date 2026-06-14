-- Migration: Add lang to print_templates + Kazakh default template
-- Down

ALTER TABLE print_templates DROP COLUMN IF EXISTS lang;
