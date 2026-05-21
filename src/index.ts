import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config, validateEnv } from './config/index.js';
import { waitForDb } from './db/client.js';
import { mealRoutes } from './api/routes/meal.js';
import { summaryRoutes } from './api/routes/summary.js';
import { recommendationRoutes } from './api/routes/recommendation.js';
import { onboardRoutes } from './api/routes/onboard.js';
import { undoRoutes } from './api/routes/undo.js';
import { healthRoutes } from './api/routes/health.js';
import { startBot } from './bot/index.js';

validateEnv(['DATABASE_URL', 'GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN']);

await waitForDb();

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Proxy header pass-through (for TrueNAS / Nginx reverse proxy)
app.use('*', async (c, next) => {
  const proto = c.req.header('x-forwarded-proto');
  const forwardedFor = c.req.header('x-forwarded-for');
  if (proto) c.set('proto' as never, proto);
  if (forwardedFor) c.set('forwardedFor' as never, forwardedFor);
  await next();
});

// Root ping
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'nutrition-bot', version: '1.0.0' });
});

// Health + API routes
app.route('/', healthRoutes);
app.route('/api', mealRoutes);
app.route('/api', summaryRoutes);
app.route('/api', recommendationRoutes);
app.route('/api', onboardRoutes);
app.route('/api', undoRoutes);

// Start server
console.log(`[api] Listening on port ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});

// Start Telegram bot (only if token is configured)
if (config.telegram.botToken) {
  startBot().catch((err) => {
    console.error('[bot] Failed to start Telegram bot:', err);
  });
} else {
  console.log('[bot] TELEGRAM_BOT_TOKEN not set, bot disabled');
}

export default app;
