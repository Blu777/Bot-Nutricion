import { supabase } from '../client.js';

export async function trackUnknownFood(
  term: string,
  userId: string | null,
  rawInput: string,
): Promise<void> {
  try {
    // Upsert: increment occurrences if already exists
    const { data } = await supabase
      .from('unknown_foods')
      .select('id, occurrences')
      .eq('term', term.toLowerCase().trim())
      .single();

    if (data) {
      await supabase
        .from('unknown_foods')
        .update({
          occurrences: (data.occurrences || 1) + 1,
          last_seen: new Date().toISOString(),
        })
        .eq('id', data.id);
    } else {
      await supabase.from('unknown_foods').insert({
        term: term.toLowerCase().trim(),
        user_id: userId,
        raw_input: rawInput,
      });
    }
  } catch (err) {
    // Never break main flow for analytics
    console.error('[unknown_foods] Failed to track:', term, err);
  }
}
