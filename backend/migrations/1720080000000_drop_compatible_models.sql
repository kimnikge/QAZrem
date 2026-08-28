-- Migration: чистка legacy compatible_models (ТЗ Блок 2 — запчасти не привязывать к моделям)
-- Up

ALTER TABLE parts DROP COLUMN IF EXISTS compatible_models;
