import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config } from './config/index.js';
import { mealRoutes } from './api/routes/meal.js';
import { summaryRoutes } from './api/routes/summary.js';
import { recommendationRoutes } from './api/routes/recommendation.js';
import { onboardRoutes } from './api/routes/onboard.js';
import { startBot } from './bot/index.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'nutrition-bot', version: '1.0.0' });
});

// API routes
app.route('/api', mealRoutes);
app.route('/api', summaryRoutes);
app.route('/api', recommendationRoutes);
app.route('/api', onboardRoutes);

// Start server
console.log(`🚀 Nutrition Bot API running on port ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});

// Start Telegram bot (only if token is configured)
if (config.telegram.botToken) {
  startBot().catch((err) => {
    console.error('❌ Failed to start Telegram bot:', err);
  });
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN not set, bot disabled');
}

export default app;
