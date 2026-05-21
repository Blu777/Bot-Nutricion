// ─── DB Query Wrapper ─────────────────────────────────────────
// Detects slow queries (> 200ms) and logs them with duration.

import { logger } from './logger.js';

const SLOW_THRESHOLD_MS = 200;

export async function dbQuery<T>(
  name: string,
  fn: () => Promise<T>,
  context?: { request_id?: string; user_id?: string },
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    if (ms > SLOW_THRESHOLD_MS) {
      logger.warn('db', 'slow_query', `Query "${name}" took ${ms}ms`, {
        ...context,
        meta: { query: name, duration_ms: ms },
      });
    }
    return result;
  } catch (err) {
    const ms = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    logger.error('db', 'query_error', `Query "${name}" failed after ${ms}ms: ${message}`, {
      ...context,
      meta: { query: name, duration_ms: ms },
    });
    throw err;
  }
}
