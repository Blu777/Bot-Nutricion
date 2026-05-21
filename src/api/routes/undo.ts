import { Hono } from 'hono';
import { getUserByTelegramId } from '../../db/queries/users.js';
import { getLastMeal, deleteMeal } from '../../db/queries/meals.js';
import { getOrCreateDailyLog, updateDailyLog } from '../../db/queries/daily-logs.js';
import { trackEvent } from '../../db/queries/events.js';
import type { NutritionValues } from '../../types/index.js';

const undoRoutes = new Hono();

undoRoutes.post('/undo-meal', async (c) => {
  const body = await c.req.json<{ telegram_id: number }>();

  if (!body.telegram_id) {
    return c.json({ error: 'telegram_id is required' }, 400);
  }

  const user = await getUserByTelegramId(body.telegram_id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const userDate = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone });
  const lastMeal = await getLastMeal(user.id, userDate);

  if (!lastMeal) {
    return c.json({ error: 'No hay comidas para deshacer hoy' }, 404);
  }

  // Delete the meal
  await deleteMeal(lastMeal.id);

  // Subtract nutrition from daily log
  const dailyLog = await getOrCreateDailyLog(user.id, userDate, user.targets);
  const newTotals: NutritionValues = {
    calories: Math.max(0, (dailyLog.nutrition_totals.calories || 0) - (lastMeal.nutrition.calories || 0)),
    protein: Math.max(0, (dailyLog.nutrition_totals.protein || 0) - (lastMeal.nutrition.protein || 0)),
    carbs: Math.max(0, (dailyLog.nutrition_totals.carbs || 0) - (lastMeal.nutrition.carbs || 0)),
    fats: Math.max(0, (dailyLog.nutrition_totals.fats || 0) - (lastMeal.nutrition.fats || 0)),
  };
  await updateDailyLog(dailyLog.id, newTotals, Math.max(0, dailyLog.meal_count - 1));

  trackEvent(user.id, 'undo_meal', {
    meal_id: lastMeal.id,
    raw_text: lastMeal.raw_text,
    nutrition: lastMeal.nutrition,
  });

  return c.json({
    undone: {
      text: lastMeal.raw_text,
      nutrition: lastMeal.nutrition,
    },
    daily: {
      consumed: newTotals,
      targets: user.targets,
    },
  });
});

export { undoRoutes };
