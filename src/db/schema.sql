-- ═══════════════════════════════════════════════════════════════
-- NUTRITION BOT — Database Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── Users ───────────────────────────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  weight_kg DECIMAL(5,1) NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('lose_fat', 'maintain', 'gain_muscle')),
  activity_level TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  targets JSONB NOT NULL DEFAULT '{"calories": 2000, "protein": 120, "carbs": 250, "fats": 65}',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Food Dictionary ─────────────────────────────────────────

CREATE TABLE food_dictionary (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  portion_size DECIMAL(6,1) NOT NULL,
  portion_unit TEXT NOT NULL DEFAULT 'g',
  nutrition_per_portion JSONB NOT NULL,
  nutrition_per_100g JSONB,
  is_composite BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_food_aliases ON food_dictionary USING GIN(aliases);

-- ─── Meals ───────────────────────────────────────────────────

CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  raw_text TEXT NOT NULL,
  parsed_items JSONB NOT NULL DEFAULT '[]',
  nutrition JSONB NOT NULL DEFAULT '{}',
  parse_method TEXT NOT NULL CHECK (parse_method IN ('dictionary', 'gemini', 'hybrid')),
  confidence DECIMAL(3,2) DEFAULT 1.0,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_meals_user_date ON meals(user_id, date);

-- ─── Daily Logs ──────────────────────────────────────────────

CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  nutrition_totals JSONB NOT NULL DEFAULT '{"calories": 0, "protein": 0, "carbs": 0, "fats": 0}',
  targets_snapshot JSONB NOT NULL DEFAULT '{}',
  meal_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date);

-- ─── Events (Analytics) ────────────────────────────────────────

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at DESC);

-- ─── Unknown Foods Tracking ──────────────────────────────────

CREATE TABLE unknown_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  raw_input TEXT,
  occurrences INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_unknown_foods_term ON unknown_foods(term);

-- ─── Triggers ────────────────────────────────────────────────

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
