-- Migration: fix part_categories id sequence after seeded row id=1
-- The initial warehouse migration inserts ('Без категории') with an explicit id,
-- which does not advance the SERIAL sequence. On a fresh database the first
-- user-created category then collides with id=1.
-- Up

SELECT setval(
  pg_get_serial_sequence('part_categories', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM part_categories), 1)
);
