// ─── Nutrition ───────────────────────────────────────────────

export interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  // Future: fiber?: number; sodium?: number; etc.
  [key: string]: number | undefined;
}

// ─── User ────────────────────────────────────────────────────

export type UserGoal = 'lose_fat' | 'maintain' | 'gain_muscle';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface User {
  id: string;
  telegram_id: number;
  name: string | null;
  weight_kg: number;
  goal: UserGoal;
  activity_level: ActivityLevel;
  targets: NutritionValues;
  timezone: string;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Food Dictionary ─────────────────────────────────────────

export interface FoodEntry {
  id: string;
  name: string;
  aliases: string[];
  category: string | null;
  portion_size: number;
  portion_unit: string;
  nutrition_per_portion: NutritionValues;
  nutrition_per_100g: NutritionValues | null;
  is_composite: boolean;
  tags: string[];
}

// ─── Parser ──────────────────────────────────────────────────

export interface ParsedItem {
  food_id: string;
  name: string;
  qty: number;
  unit: 'portion' | 'g' | 'ml' | 'kg';
  grams?: number;
  matched: boolean;
}

export interface ParseResult {
  items: ParsedItem[];
  confidence: number;
  method: 'dictionary' | 'gemini' | 'hybrid';
  unmatched: string[];
}

// ─── Meal ────────────────────────────────────────────────────

export interface Meal {
  id: string;
  user_id: string;
  raw_text: string;
  parsed_items: ParsedItem[];
  nutrition: NutritionValues;
  parse_method: string;
  confidence: number;
  logged_at: string;
  date: string;
}

// ─── Daily Log ───────────────────────────────────────────────

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  nutrition_totals: NutritionValues;
  targets_snapshot: NutritionValues;
  meal_count: number;
}

// ─── API ─────────────────────────────────────────────────────

export interface LogMealRequest {
  telegram_id: number;
  text: string;
}

export interface LogMealResponse {
  meal: {
    id: string;
    items: Array<{
      name: string;
      qty: number;
      nutrition: NutritionValues;
    }>;
    total: NutritionValues;
  };
  daily: {
    consumed: NutritionValues;
    targets: NutritionValues;
    remaining: NutritionValues;
  };
  recommendation: {
    text: string;
    suggested_foods: string[];
  };
}
