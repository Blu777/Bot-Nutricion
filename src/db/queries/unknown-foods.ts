import { sql } from '../client.js';

export async function trackUnknownFood(
  term: string,
  userId: string | null,
  rawInput: string,
): Promise<void> {
  try {
    const normalised = term.toLowerCase().trim();
    // Upsert: increment occurrences if already exists
    await sql`
      INSERT INTO unknown_foods (term, user_id, raw_input)
      VALUES (${normalised}, ${userId}, ${rawInput})
      ON CONFLICT (term)
      DO UPDATE SET
        occurrences = unknown_foods.occurrences + 1,
        last_seen   = NOW()
    `;
  } catch (err) {
    // Never break main flow for analytics
    console.error('[unknown_foods] Failed to track:', term, err);
  }
}
