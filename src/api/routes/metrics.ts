import { Hono } from 'hono';
import { metrics } from '../../lib/metrics.js';

export const metricsRoutes = new Hono();

metricsRoutes.get('/metrics', (c) => {
  return c.json(metrics.snapshot());
});
