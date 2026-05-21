import { supabase } from '../client.js';

export type EventType =
  | 'onboard_started'
  | 'onboard_completed'
  | 'log_meal'
  | 'undo_meal'
  | 'gemini_usage'
  | 'unknown_food'
  | 'parse_failure';

export async function trackEvent(
  userId: string | null,
  type: EventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from('events').insert({
      user_id: userId,
      type,
      metadata,
    });
  } catch (err) {
    // Never let analytics tracking break the main flow
    console.error('[events] Failed to track:', type, err);
  }
}
