import { Hono } from 'hono';
import { getUserByTelegramId, updateUser } from '../../db/queries/users.js';
import { calculateTargets } from '../../core/nutrition/targets.js';
import { trackEvent } from '../../db/queries/events.js';
import type { UserGoal, ActivityLevel } from '../../types/index.js';

const userRoutes = new Hono();

// GET /api/user/:telegramId
// Returns current user profile (for update flow prefill)
userRoutes.get('/user/:telegramId', async (c) => {
  const telegramIdParam = c.req.param('telegramId');
  const telegramId = parseInt(telegramIdParam, 10);

  if (isNaN(telegramId)) {
    return c.json({ error: { type: 'USER_ERROR', message: 'Invalid telegram_id' } }, 400);
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return c.json({ error: { type: 'USER_ERROR', message: 'User not found' } }, 404);
  }

  return c.json({
    user_id: user.id,
    name: user.name,
    weight_kg: user.weight_kg,
    goal: user.goal,
    goal_label: GOAL_LABELS.get(user.goal) ?? 'Desconocido',
    activity_level: user.activity_level,
    targets: user.targets,
  });
});

const GOAL_LABELS = new Map<UserGoal, string>([
  ['lose_fat', 'Perder grasa'],
  ['maintain', 'Mantener peso'],
  ['gain_muscle', 'Ganar músculo']
]);

interface UpdateProfileRequest {
  weight_kg?: number;
  goal?: string;
}

// PATCH /api/user/:telegramId
// Body: { weight_kg?: number, goal?: "lose_fat"|"maintain"|"gain_muscle" }
// Both fields optional but at least one required.
userRoutes.patch('/user/:telegramId', async (c) => {
  const telegramIdParam = c.req.param('telegramId');
  const telegramId = parseInt(telegramIdParam, 10);

  if (isNaN(telegramId)) {
    return c.json({ error: { type: 'USER_ERROR', message: 'Invalid telegram_id' } }, 400);
  }

  const body = await c.req.json<UpdateProfileRequest>();

  if (body.weight_kg === undefined && body.goal === undefined) {
    return c.json({ error: { type: 'USER_ERROR', message: 'At least one of weight_kg or goal is required' } }, 400);
  }

  // Validate weight range
  if (body.weight_kg !== undefined) {
    if (typeof body.weight_kg !== 'number' || body.weight_kg < 30 || body.weight_kg > 300) {
      return c.json({ error: { type: 'USER_ERROR', message: 'weight_kg must be a number between 30 and 300' } }, 400);
    }
  }

  // Validate goal
  const validGoals: UserGoal[] = ['lose_fat', 'maintain', 'gain_muscle'];
  if (body.goal !== undefined && !validGoals.includes(body.goal as UserGoal)) {
    return c.json({ error: { type: 'USER_ERROR', message: 'goal must be one of: lose_fat, maintain, gain_muscle' } }, 400);
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return c.json({ error: { type: 'USER_ERROR', message: 'User not found. Complete onboarding first.' } }, 404);
  }

  const previousTargets = { ...user.targets };
  const previousWeight  = user.weight_kg;
  const previousGoal    = user.goal;

  const newWeight: number        = body.weight_kg ?? user.weight_kg;
  const newGoal: UserGoal        = (body.goal as UserGoal) ?? user.goal;
  const activityLevel: ActivityLevel = user.activity_level;

  const newTargets = calculateTargets(newWeight, newGoal, activityLevel);

  await updateUser(user.id, {
    weight_kg: newWeight,
    goal:      newGoal,
    targets:   newTargets,
  });

  trackEvent(user.id, 'profile_updated', {
    previous: { weight_kg: previousWeight, goal: previousGoal, targets: previousTargets },
    updated:  { weight_kg: newWeight, goal: newGoal, targets: newTargets },
  });

  return c.json({
    user_id:  user.id,
    previous: { weight_kg: previousWeight, goal: previousGoal, targets: previousTargets, goal_label: GOAL_LABELS.get(previousGoal) ?? 'Desconocido' },
    updated:  { weight_kg: newWeight, goal: newGoal, targets: newTargets, goal_label: GOAL_LABELS.get(newGoal) ?? 'Desconocido' },
  });
});

export { userRoutes };
