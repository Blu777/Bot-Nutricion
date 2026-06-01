-- ═══════════════════════════════════════════════════════════════
-- Migration 003 — Add audit features
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('aprobado', 'incompleto', 'fuera_de_plan', 'pendiente')) DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS missing_components JSONB DEFAULT '[]';

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS is_training_day BOOLEAN DEFAULT false;
