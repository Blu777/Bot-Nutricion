import { Hono } from 'hono';
import { sql } from '../../db/client.js';

export const debugRoutes = new Hono();

// GET /debug/last-logs?user_id=<telegram_id>&limit=20
// Returns last N events for a user — useful for debugging without log access.
debugRoutes.get('/debug/last-logs', async (c) => {
  const userIdParam = c.req.query('user_id');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);

  if (!userIdParam) {
    return c.json({ error: { type: 'USER_ERROR', message: 'user_id query param required' } }, 400);
  }

  // Accept either telegram_id (number) or internal UUID
  const isTelegramId = /^\d+$/.test(userIdParam);

  let internalUserId: string | null = null;

  if (isTelegramId) {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE telegram_id = ${parseInt(userIdParam, 10)} LIMIT 1
    `;
    internalUserId = rows[0]?.id ?? null;
  } else {
    internalUserId = userIdParam;
  }

  if (!internalUserId) {
    return c.json({ error: { type: 'USER_ERROR', message: 'User not found' } }, 404);
  }

  const events = await sql<{ type: string; metadata: unknown; created_at: string }[]>`
    SELECT type, metadata, created_at
    FROM events
    WHERE user_id = ${internalUserId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return c.json({ user_id: internalUserId, count: events.length, events });
});
