-- ═══════════════════════════════════════════════════════════════
-- Migration 002 — Add food metadata columns to food_dictionary
-- 2026-05-22
--
-- Context: seed/food-dictionary.ts declares these fields on food
-- objects but the table lacked the columns; values were silently
-- dropped on INSERT. This migration adds them without data loss
-- (all nullable / with safe defaults).
--
-- Run ONCE against the target database. Schema.sql has already
-- been updated to reflect the final state.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE food_dictionary
  ADD COLUMN IF NOT EXISTS cooking_method   TEXT,
  ADD COLUMN IF NOT EXISTS cooking_note     TEXT,
  ADD COLUMN IF NOT EXISTS cut_variance     JSONB,
  ADD COLUMN IF NOT EXISTS estimation_note  TEXT,
  ADD COLUMN IF NOT EXISTS dressing_note    TEXT,
  ADD COLUMN IF NOT EXISTS ask_dressing     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS typical_serving  DECIMAL(6,1),
  ADD COLUMN IF NOT EXISTS serving_note     TEXT;
