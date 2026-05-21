import { validateEnv } from '../config/index.js';
import { startBot } from './index.js';

validateEnv(['TELEGRAM_BOT_TOKEN', 'API_BASE_URL']);

const MAX_RESTARTS = 10;
const BASE_DELAY_MS = 3000;

async function run(): Promise<void> {
  let restarts = 0;

  while (restarts < MAX_RESTARTS) {
    try {
      console.log(`[bot] Starting (attempt ${restarts + 1})`);
      await startBot();
      // startBot() only resolves on clean stop — reset counter
      restarts = 0;
    } catch (err) {
      restarts++;
      const delay = Math.min(BASE_DELAY_MS * restarts, 30_000);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[bot] Crashed: ${msg}. Restarting in ${delay}ms (${restarts}/${MAX_RESTARTS})`);
      if (restarts >= MAX_RESTARTS) {
        console.error('[bot] Maximum restarts reached — exiting');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

process.on('SIGTERM', () => {
  console.log('[bot] SIGTERM received — shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[bot] SIGINT received — shutting down');
  process.exit(0);
});

run();
