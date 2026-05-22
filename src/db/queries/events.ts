import { sql } from '../client.js';

export type EventType =
  | 'onboard_started'
  | 'onboard_completed'
  | 'log_meal'
  | 'undo_meal'
  | 'gemini_usage'
  | 'unknown_food'
  | 'parse_failure'
  | 'profile_updated';

export async function trackEvent(
  userId: string | null,
  type: EventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await sql`
      INSERT INTO events (user_id, type, metadata)
      VALUES (${userId}, ${type}, ${sql.json(metadata as any)})
    `;
  } catch (err) {
    // Never let analytics tracking break the main flow
    console.error('[events] Failed to track:', type, err);
  }
}
