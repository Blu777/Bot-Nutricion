import postgres from 'postgres';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 1800,
});

export async function waitForDb(retries = 10, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await sql`SELECT 1`;
      logger.info('db', 'connected', 'Connection established');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('db', 'not_ready', `Attempt ${i}/${retries}: ${msg}`);
      if (i === retries) {
        logger.error('db', 'connect_failed', 'Could not connect after maximum retries — exiting');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
