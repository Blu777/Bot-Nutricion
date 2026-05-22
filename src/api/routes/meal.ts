import { Hono } from 'hono';
import { parseMealText } from '../../core/parser/index.js';
import { applyGeminiFallback } from '../../core/parser/fallback.js';
import { estimateNutritionWithGemini } from '../../core/parser/gemini-estimator.js';
import { calculateMealNutrition, calculateItemNutrition, calculateRemaining } from '../../core/nutrition/calculator.js';
import { generateRecommendation } from '../../core/recommendation/engine.js';
import { getUserByTelegramId } from '../../db/queries/users.js';
import { createMeal, deleteTodayMeals } from '../../db/queries/meals.js';
import { getOrCreateDailyLog, updateDailyLog } from '../../db/queries/daily-logs.js';
import { getAllFoods } from '../../db/queries/food-dictionary.js';
import { trackEvent } from '../../db/queries/events.js';
import { trackUnknownFood } from '../../db/queries/unknown-foods.js';
import { logger } from '../../lib/logger.js';
import { metrics } from '../../lib/metrics.js';
import { config } from '../../config/index.js';
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
  const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
  const body = await c.req.json<LogMealRequest>();

  if (!body.telegram_id || !body.text) {
    return c.json({ error: { type: 'USER_ERROR', message: 'telegram_id and text are required', request_id: requestId } }, 400);
  }

  // 1. Get user
  const user = await getUserByTelegramId(body.telegram_id);
  if (!user) {
    return c.json({ error: { type: 'USER_ERROR', message: 'User not found. Complete onboarding first.', request_id: requestId } }, 404);
  }

  // 2. Parse meal text (normalize → tokenize → match)
  const dictionary = await getFoodDictionary();
  const { result: initialParseResult, log: parseLog } = parseMealText(body.text, dictionary);

  // 3. Log parse pipeline for debugging
  logger.debug('parser', 'parse_complete', `Parsed "${body.text}"`, {
    request_id: requestId,
    user_id: user.id,
    meta: { confidence: parseLog.overall_confidence, tokens: parseLog.tokens.length },
  });

  // 3b. Gemini fallback (only when confidence < 0.7 or unknown items)
  const { result: parseResult, fallbackLog } = await applyGeminiFallback(
    initialParseResult,
    parseLog,
    dictionary,
    user.id,
    requestId,
  );
  if (fallbackLog.triggered) {
    logger.info('fallback', 'fallback_complete', `method=${fallbackLog.final_method} remapped=${fallbackLog.remapped_items.length}`, {
      request_id: requestId,
      user_id: user.id,
      meta: { reason: fallbackLog.reason, gemini_called: fallbackLog.gemini_called },
    });
  }

  // 3c. Guard: if parser returned zero items, return error
  if (parseResult.items.length === 0) {
    metrics.incParseFailure();
    trackEvent(user.id, 'parse_failure', { raw_text: body.text, confidence: 0 });
    logger.warn('parser', 'parse_failure', `Zero items parsed for: "${body.text}"`, { request_id: requestId, user_id: user.id });
    return c.json({ error: { type: 'PARSE_ERROR', message: 'No pude interpretar la comida. Intentá ser más específico.', request_id: requestId } }, 422);
  }

  // 4. Estimate nutrition for any remaining unmatched items via Gemini
  const foodMap = getFoodMap();
  const unknownEstimates = new Map<string, NutritionValues>();
  const unmatchedItems = parseResult.items.filter((i) => !i.matched);
  if (unmatchedItems.length > 0 && config.gemini.apiKey) {
    for (const item of unmatchedItems) {
      const grams = item.grams ?? (item.unit === 'g' || item.unit === 'ml' ? item.qty : 100);
      const estimate = await estimateNutritionWithGemini(item.name, grams);
      if (estimate) {
        unknownEstimates.set(item.name, {
          calories: estimate.calories,
          protein: estimate.protein,
          carbs: estimate.carbs,
          fats: estimate.fats,
        });
        logger.info('fallback', 'gemini_nutrition_estimate', `${item.name} (${grams}g) → ${Math.round(estimate.calories)} cal`, {
          request_id: requestId,
          user_id: user.id,
        });
      }
    }
  }

  // 4b. Calculate nutrition (with pre-computed estimates for unknowns)
  const mealNutrition = calculateMealNutrition(parseResult.items, foodMap, unknownEstimates);

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
  const todayFoodIds = parseResult.items.map((i) => i.food_id).filter(Boolean);
  const recommendation = generateRecommendation(remaining, newTotals, user.targets, todayFoodIds);

  // 10. Check if any items are estimated
  const hasEstimated = parseResult.items.some((item) => !item.matched);

  // 11. Build human-readable message
  const message = buildMessage(mealNutrition, newTotals, user.targets, hasEstimated);

  // 12. Build response
  const response = {
    meal: {
      id: meal.id,
      items: parseResult.items.map((item) => ({
        food_id: item.food_id,
        name: item.name,
        qty: item.qty,
        matched: item.matched,
        nutrition: calculateItemNutrition(item, foodMap, unknownEstimates),
      })),
      total: mealNutrition,
      confidence: parseResult.confidence,
      estimated: hasEstimated,
      unmatched: parseResult.unmatched,
      quantity_warnings: parseResult.quantity_warnings,
    },
    daily: {
      consumed: newTotals,
      targets: user.targets,
      remaining,
    },
    recommendation,
    message,
  };

  // 13. Metrics + log
  metrics.incMealLog();
  if (fallbackLog.triggered && fallbackLog.gemini_called) metrics.incGeminiCall();
  for (const _t of parseResult.unmatched) metrics.incUnknownFood();

  logger.info('api', 'meal_logged', `user=${user.id} items=${parseResult.items.length} confidence=${parseResult.confidence}`, {
    request_id: requestId,
    user_id: user.id,
    meta: { method: parseResult.method, unmatched: parseResult.unmatched },
  });

  // Track events (fire-and-forget)
  trackEvent(user.id, 'log_meal', {
    raw_text: body.text,
    confidence: parseResult.confidence,
    method: parseResult.method,
    items_count: parseResult.items.length,
    unmatched: parseResult.unmatched,
    gemini_used: fallbackLog.triggered,
  });

  if (fallbackLog.triggered) {
    trackEvent(user.id, 'gemini_usage', {
      reason: fallbackLog.reason,
      called: fallbackLog.gemini_called,
      remapped: fallbackLog.remapped_items,
    });
  }

  // Track unknown foods
  for (const term of parseResult.unmatched) {
    trackUnknownFood(term, user.id, body.text);
    trackEvent(user.id, 'unknown_food', { term, raw_text: body.text });
  }

  return c.json(response, 201);
});

mealRoutes.delete('/meals/today/:telegram_id', async (c) => {
  const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
  const telegramId = Number(c.req.param('telegram_id'));

  if (!telegramId) {
    return c.json({ error: { type: 'USER_ERROR', message: 'telegram_id is required', request_id: requestId } }, 400);
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return c.json({ error: { type: 'USER_ERROR', message: 'User not found', request_id: requestId } }, 404);
  }

  const userDate = getUserLocalDate(user.timezone);
  const deletedCount = await deleteTodayMeals(user.id, userDate);

  // Reset daily log to zero so the summary reflects the deletion
  const dailyLog = await getOrCreateDailyLog(user.id, userDate, user.targets);
  await updateDailyLog(dailyLog.id, { calories: 0, protein: 0, carbs: 0, fats: 0 }, 0);

  logger.info('api', 'reset_today', `user=${user.id} deleted=${deletedCount} date=${userDate}`, {
    request_id: requestId,
    user_id: user.id,
  });

  return c.json({ success: true, deleted_count: deletedCount, date: userDate });
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
