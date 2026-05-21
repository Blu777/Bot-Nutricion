import { Hono } from 'hono';
import { parseMealText } from '../../core/parser/index.js';
import { applyGeminiFallback } from '../../core/parser/fallback.js';
import { calculateMealNutrition, calculateItemNutrition, calculateRemaining } from '../../core/nutrition/calculator.js';
import { generateRecommendation } from '../../core/recommendation/engine.js';
import { getUserByTelegramId } from '../../db/queries/users.js';
import { createMeal } from '../../db/queries/meals.js';
import { getOrCreateDailyLog, updateDailyLog } from '../../db/queries/daily-logs.js';
import { getAllFoods } from '../../db/queries/food-dictionary.js';
import type { LogMealRequest, FoodEntry, NutritionValues } from '../../types/index.js';

const mealRoutes = new Hono();

// In-memory food dictionary cache
let foodDictionaryCache: FoodEntry[] | null = null;
let foodMapCache: Map<string, FoodEntry> | null = null;

async function getFoodDictionary(): Promise<FoodEntry[]> {
  if (!foodDictionaryCache) {
    foodDictionaryCache = await getAllFoods();
    foodMapCache = new Map(foodDictionaryCache.map((f) => [f.id, f]));
  }
  return foodDictionaryCache;
}

function getFoodMap(): Map<string, FoodEntry> {
  return foodMapCache ?? new Map();
}

// Invalidate cache (call when dictionary is updated)
export function invalidateFoodCache(): void {
  foodDictionaryCache = null;
  foodMapCache = null;
}

mealRoutes.post('/log-meal', async (c) => {
  const body = await c.req.json<LogMealRequest>();

  if (!body.telegram_id || !body.text) {
    return c.json({ error: 'telegram_id and text are required' }, 400);
  }

  // 1. Get user
  const user = await getUserByTelegramId(body.telegram_id);
  if (!user) {
    return c.json({ error: 'User not found. Complete onboarding first.' }, 404);
  }

  // 2. Parse meal text (normalize → tokenize → match)
  const dictionary = await getFoodDictionary();
  const { result: initialParseResult, log: parseLog } = parseMealText(body.text, dictionary);

  // 3. Log parse pipeline for debugging
  console.log('[parse]', JSON.stringify(parseLog));

  // 3b. Gemini fallback (only when confidence < 0.7 or unknown items)
  const { result: parseResult, fallbackLog } = await applyGeminiFallback(
    initialParseResult,
    parseLog,
    dictionary,
  );
  if (fallbackLog.triggered) {
    console.log('[fallback]', JSON.stringify(fallbackLog));
  }

  // 4. Calculate nutrition
  const foodMap = getFoodMap();
  const mealNutrition = calculateMealNutrition(parseResult.items, foodMap);

  // 5. Get user's local date
  const userDate = getUserLocalDate(user.timezone);

  // 6. Save meal (stores raw_text, parsed_items, nutrition, confidence)
  const meal = await createMeal({
    user_id: user.id,
    raw_text: body.text,
    parsed_items: parseResult.items,
    nutrition: mealNutrition,
    parse_method: parseResult.method,
    confidence: parseResult.confidence,
    date: userDate,
  });

  // 7. Update daily log incrementally
  const dailyLog = await getOrCreateDailyLog(user.id, userDate, user.targets);
  const newTotals: NutritionValues = {
    calories: (dailyLog.nutrition_totals.calories || 0) + mealNutrition.calories,
    protein: (dailyLog.nutrition_totals.protein || 0) + mealNutrition.protein,
    carbs: (dailyLog.nutrition_totals.carbs || 0) + mealNutrition.carbs,
    fats: (dailyLog.nutrition_totals.fats || 0) + mealNutrition.fats,
  };
  await updateDailyLog(dailyLog.id, newTotals, dailyLog.meal_count + 1);

  // 8. Calculate remaining
  const remaining = calculateRemaining(user.targets, newTotals);

  // 9. Generate recommendation (with fat excess detection)
  const recommendation = generateRecommendation(remaining, newTotals, user.targets);

  // 10. Check if any items are estimated
  const hasEstimated = parseResult.items.some((item) => !item.matched);

  // 11. Build human-readable message
  const message = buildMessage(mealNutrition, newTotals, user.targets, hasEstimated);

  // 12. Build response
  const response = {
    meal: {
      id: meal.id,
      items: parseResult.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        matched: item.matched,
        nutrition: calculateItemNutrition(item, foodMap),
      })),
      total: mealNutrition,
      confidence: parseResult.confidence,
      estimated: hasEstimated,
      unmatched: parseResult.unmatched,
    },
    daily: {
      consumed: newTotals,
      targets: user.targets,
      remaining,
    },
    recommendation,
    message,
  };

  return c.json(response, 201);
});

function getUserLocalDate(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

function buildMessage(
  added: NutritionValues,
  totals: NutritionValues,
  targets: NutritionValues,
  estimated: boolean,
): string {
  const prefix = estimated ? '⚠️ Algunos alimentos fueron estimados.\n' : '';
  const protRemaining = Math.max(0, targets.protein - totals.protein);
  const calRemaining = Math.max(0, targets.calories - totals.calories);

  let msg = `${prefix}Sumaste ~${added.protein}g prot, ~${added.calories} cal.`;
  msg += `\nProteína: ${totals.protein}/${targets.protein}g`;
  msg += ` · Calorías: ${totals.calories}/${targets.calories}`;

  if (protRemaining > 0) {
    msg += `\nTe faltan ~${protRemaining}g de proteína y ~${calRemaining} cal.`;
  } else {
    msg += '\n¡Objetivo de proteína alcanzado!';
  }

  return msg;
}

export { mealRoutes };
