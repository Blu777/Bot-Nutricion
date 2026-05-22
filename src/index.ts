import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config, validateEnv } from './config/index.js';
import { waitForDb } from './db/client.js';
import { logger } from './lib/logger.js';
import { requestContext } from './api/middleware/request-context.js';
import { apiKeyAuth } from './api/middleware/auth.js';
import { mealRoutes } from './api/routes/meal.js';
import { summaryRoutes } from './api/routes/summary.js';
import { recommendationRoutes } from './api/routes/recommendation.js';
import { onboardRoutes } from './api/routes/onboard.js';
import { undoRoutes } from './api/routes/undo.js';
import { healthRoutes } from './api/routes/health.js';
import { metricsRoutes } from './api/routes/metrics.js';
import { debugRoutes } from './api/routes/debug.js';
import { adminRoutes } from './api/routes/admin.js';
import { observabilityRoutes } from './api/routes/observability.js';
import { userRoutes } from './api/routes/user.js';
import { startBot } from './bot/index.js';

validateEnv(['DATABASE_URL', 'GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN']);

await waitForDb();

const app = new Hono();

// Middleware
app.use('*', requestContext);
app.use('*', cors());

// Proxy header pass-through (for TrueNAS / Nginx reverse proxy)
app.use('*', async (c, next) => {
  const proto = c.req.header('x-forwarded-proto');
  const forwardedFor = c.req.header('x-forwarded-for');
  if (proto) c.set('proto' as never, proto);
  if (forwardedFor) c.set('forwardedFor' as never, forwardedFor);
  await next();
});

// Global error handler — returns structured error response
app.onError((err, c) => {
  const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
  logger.error('api', 'unhandled_error', err.message, {
    request_id: requestId,
    meta: { stack: err.stack?.split('\n')[1]?.trim() },
  });
  return c.json(
    { error: { type: 'SYSTEM_ERROR', message: 'Internal server error', request_id: requestId } },
    500,
  );
});

// Root ping
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'nutrition-bot', version: '1.0.0' });
});

// Routes (public — no auth)
app.route('/', healthRoutes);
app.route('/', metricsRoutes);
app.route('/', observabilityRoutes);

// Protected API routes (require x-api-secret header)
app.use('/api/*', apiKeyAuth);
app.route('/api', mealRoutes);
app.route('/api', summaryRoutes);
app.route('/api', recommendationRoutes);
app.route('/api', onboardRoutes);
app.route('/api', undoRoutes);
app.route('/api', userRoutes);

// Admin / debug (keep public for now, or protect separately)
app.route('/', debugRoutes);
app.route('/', adminRoutes);

logger.info('api', 'server_start', `Listening on port ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});

// Start Telegram bot (only if token is configured)
if (config.telegram.botToken) {
  startBot().catch((err) => {
    logger.error('bot', 'start_failed', err instanceof Error ? err.message : String(err));
  });
} else {
  logger.warn('bot', 'token_missing', 'TELEGRAM_BOT_TOKEN not set, bot disabled');
}

export default app;
