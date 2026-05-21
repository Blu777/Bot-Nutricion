import { Hono } from 'hono';
import { sql } from '../../db/client.js';

export const adminRoutes = new Hono();

// GET /admin/top-unknown-foods?limit=20
// Shows the most-seen unrecognised food terms — feedback loop for expanding the dictionary.
adminRoutes.get('/admin/top-unknown-foods', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);

  const rows = await sql<{ term: string; occurrences: number; last_seen: string }[]>`
    SELECT term, occurrences, last_seen
    FROM unknown_foods
    ORDER BY occurrences DESC, last_seen DESC
    LIMIT ${limit}
  `;

  return c.json({ count: rows.length, items: rows });
});
