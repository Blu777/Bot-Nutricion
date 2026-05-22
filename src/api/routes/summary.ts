import { Hono } from 'hono';
import { getUserByTelegramId } from '../../db/queries/users.js';
import { getMealsByUserAndDate } from '../../db/queries/meals.js';
import { getOrCreateDailyLog } from '../../db/queries/daily-logs.js';
import { calculateRemaining } from '../../core/nutrition/calculator.js';
import { generateRecommendation } from '../../core/recommendation/engine.js';

const summaryRoutes = new Hono();

summaryRoutes.get('/daily-summary', async (c) => {
  const telegramId = Number(c.req.query('telegram_id'));

  if (!telegramId) {
    return c.json({ error: 'telegram_id query parameter is required' }, 400);
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const userDate = new Date().toLocaleDateString('en-CA', { timeZone: user.timezone });
  const dailyLog = await getOrCreateDailyLog(user.id, userDate, user.targets);
  const meals = await getMealsByUserAndDate(user.id, userDate);
  const remaining = calculateRemaining(user.targets, dailyLog.nutrition_totals);
  const todayFoodIds = meals.flatMap((m) => m.parsed_items).map((i) => i.food_id).filter(Boolean);
  const recommendation = generateRecommendation(remaining, dailyLog.nutrition_totals, user.targets, todayFoodIds);

  const progressPct = {
    calories: Math.round((dailyLog.nutrition_totals.calories / user.targets.calories) * 100),
    protein: Math.round((dailyLog.nutrition_totals.protein / user.targets.protein) * 100),
    carbs: Math.round((dailyLog.nutrition_totals.carbs / user.targets.carbs) * 100),
    fats: Math.round((dailyLog.nutrition_totals.fats / user.targets.fats) * 100),
  };

  return c.json({
    date: userDate,
    meals: meals.map((m) => ({
      time: new Date(m.logged_at).toLocaleTimeString('es-AR', {
        timeZone: user.timezone,
        hour: '2-digit',
        minute: '2-digit',
      }),
      text: m.raw_text,
      nutrition: m.nutrition,
    })),
    totals: dailyLog.nutrition_totals,
    targets: user.targets,
    remaining,
    progress_pct: progressPct,
    recommendation,
  });
});

export { summaryRoutes };
