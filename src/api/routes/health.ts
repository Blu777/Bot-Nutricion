import { Hono } from 'hono';
import { sql } from '../../db/client.js';

const startTime = Date.now();

export const healthRoutes = new Hono();

healthRoutes.get('/health', async (c) => {
  let dbStatus: 'connected' | 'error' = 'error';
  try {
    await sql`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return c.json({ status, db: dbStatus, uptime }, status === 'ok' ? 200 : 503);
});
