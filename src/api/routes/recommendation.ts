import { Hono } from 'hono';
import { getUserByTelegramId } from '../../db/queries/users.js';
import { getOrCreateDailyLog } from '../../db/queries/daily-logs.js';
import { calculateRemaining } from '../../core/nutrition/calculator.js';
import { generateRecommendation } from '../../core/recommendation/engine.js';

const recommendationRoutes = new Hono();

recommendationRoutes.get('/recommendation', async (c) => {
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
  const remaining = calculateRemaining(user.targets, dailyLog.nutrition_totals);

  // Determine time of day for context
  const now = new Date();
  const hour = parseInt(
    now.toLocaleTimeString('en-US', { timeZone: user.timezone, hour: 'numeric', hour12: false })
  );
  let timeOfDay: string;
  if (hour < 12) timeOfDay = 'mañana';
  else if (hour < 17) timeOfDay = 'tarde';
  else timeOfDay = 'noche';

  const recommendation = generateRecommendation(remaining, dailyLog.nutrition_totals, user.targets);

  return c.json({
    context: {
      time_of_day: timeOfDay,
      remaining,
      consumed: dailyLog.nutrition_totals,
      targets: user.targets,
    },
    recommendation,
  });
});

export { recommendationRoutes };
