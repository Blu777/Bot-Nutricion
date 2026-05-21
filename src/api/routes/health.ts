import { Hono } from 'hono';
import { sql } from '../../db/client.js';
import { metrics } from '../../lib/metrics.js';

export const healthRoutes = new Hono();

healthRoutes.get('/health', async (c) => {
  let dbStatus: 'connected' | 'error' = 'error';
  try {
    await sql`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  const snap = metrics.snapshot();
  const status = dbStatus === 'connected' ? 'ok' : 'degraded';

  return c.json({
    status,
    db: dbStatus,
    uptime: snap.uptime,
    requests_total: snap.requests_total,
    avg_latency_ms: snap.avg_latency_ms,
  }, status === 'ok' ? 200 : 503);
});
