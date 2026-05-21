// ─── Request Context Middleware ───────────────────────────────
// Attaches request_id to every request.
// Records per-route hit count and response latency.

import type { MiddlewareHandler } from 'hono';
import { logger } from '../../lib/logger.js';
import { metrics } from '../../lib/metrics.js';

let counter = 0;

function genRequestId(): string {
  // Short, sortable, collision-resistant enough for a single process
  return `${Date.now().toString(36)}-${(++counter).toString(36)}`;
}

export const requestContext: MiddlewareHandler = async (c, next) => {
  const requestId = genRequestId();
  const start = Date.now();

  c.set('requestId' as never, requestId);

  const method = c.req.method;
  const path   = new URL(c.req.url).pathname;
  const route  = `${method} ${path}`;

  metrics.incRequest(route);

  logger.info('api', 'request_start', `${method} ${path}`, { request_id: requestId });

  await next();

  const latency = Date.now() - start;
  metrics.recordLatency(latency);

  const status = c.res.status;

  logger.info('api', 'request_end', `${method} ${path} → ${status}`, {
    request_id: requestId,
    latency_ms: latency,
    meta: { status },
  });
};
