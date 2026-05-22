// ─── Simple API Key Middleware ────────────────────────────────
// Shared-secret between Bot and API. Prevents open access to endpoints.

import type { MiddlewareHandler } from 'hono';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  // Skip auth if no secret is configured (development fallback)
  if (!config.apiSecret) {
    logger.warn('api', 'auth_disabled', 'API_SECRET not set — endpoints are open');
    await next();
    return;
  }

  const header = c.req.header('x-api-secret');
  if (header !== config.apiSecret) {
    logger.warn('api', 'auth_denied', 'Invalid or missing x-api-secret header', {
      request_id: c.get('requestId' as never) as string | undefined,
    });
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
};
