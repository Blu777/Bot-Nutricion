import { Hono } from 'hono';
import { getUserByTelegramId, createUser } from '../../db/queries/users.js';
import { calculateTargets } from '../../core/nutrition/targets.js';
import { config } from '../../config/index.js';
import { trackEvent } from '../../db/queries/events.js';
import type { UserGoal, ActivityLevel } from '../../types/index.js';

const onboardRoutes = new Hono();

interface OnboardRequest {
  telegram_id: number;
  name?: string;
  weight_kg: number;
  goal?: UserGoal;
  activity_level?: ActivityLevel;
}

onboardRoutes.post('/onboard', async (c) => {
  const body = await c.req.json<OnboardRequest>();

  if (!body.telegram_id || !body.weight_kg) {
    return c.json({ error: 'telegram_id and weight_kg are required' }, 400);
  }

  trackEvent(null, 'onboard_started', { telegram_id: body.telegram_id });

  // Check if user already exists
  const existing = await getUserByTelegramId(body.telegram_id);
  if (existing) {
    return c.json({ error: 'User already onboarded', user_id: existing.id }, 409);
  }

  const goal: UserGoal = body.goal || 'maintain';
  const activityLevel: ActivityLevel = body.activity_level || 'moderate';
  const targets = calculateTargets(body.weight_kg, goal, activityLevel);

  const user = await createUser({
    telegram_id: body.telegram_id,
    name: body.name || null,
    weight_kg: body.weight_kg,
    goal,
    activity_level: activityLevel,
    targets,
    timezone: config.defaults.timezone,
    onboarded: true,
  });

  trackEvent(user.id, 'onboard_completed', {
    weight_kg: body.weight_kg,
    goal,
    activity_level: activityLevel,
    targets,
  });

  return c.json({
    user_id: user.id,
    targets,
    message: `Perfecto! Tu objetivo diario: ${targets.calories} cal, ${targets.protein}g proteína, ${targets.carbs}g carbos, ${targets.fats}g grasas.`,
  }, 201);
});

export { onboardRoutes };
