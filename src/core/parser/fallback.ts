// ─── Gemini Fallback Layer ────────────────────────────────────
// Runs AFTER the deterministic parser.
// Only triggers when confidence < 0.7 OR unknown items exist.
// Maps Gemini suggestions back to the local food dictionary.
// NEVER trusts Gemini for nutrition — only for food identification.

import { callGemini } from './gemini.js';
import { matchFood } from './matcher.js';
import type { ParseResult, ParsedItem, FoodEntry } from '../../types/index.js';
import type { ParseLog } from './index.js';

const CONFIDENCE_THRESHOLD = 0.7;

export interface FallbackLog {
  triggered: boolean;
  reason: string | null;
  gemini_called: boolean;
  gemini_response: Array<{ original_text: string; suggested_food_id: string | null; suggested_name: string }> | null;
  remapped_items: Array<{ from: string; to: string; food_id: string }>;
  final_method: ParseResult['method'];
}

export async function applyGeminiFallback(
  parseResult: ParseResult,
  parseLog: ParseLog,
  dictionary: FoodEntry[],
): Promise<{ result: ParseResult; fallbackLog: FallbackLog }> {
  const fallbackLog: FallbackLog = {
    triggered: false,
    reason: null,
    gemini_called: false,
    gemini_response: null,
    remapped_items: [],
    final_method: parseResult.method,
  };

  // Decide whether to trigger Gemini
  const hasUnmatched = parseResult.unmatched.length > 0;
  const lowConfidence = parseResult.confidence < CONFIDENCE_THRESHOLD;

  if (!hasUnmatched && !lowConfidence) {
    // Parser did well enough, no fallback needed
    return { result: parseResult, fallbackLog };
  }

  // Determine reason
  const reasons: string[] = [];
  if (lowConfidence) reasons.push(`confidence=${parseResult.confidence} < ${CONFIDENCE_THRESHOLD}`);
  if (hasUnmatched) reasons.push(`unmatched=[${parseResult.unmatched.join(', ')}]`);

  fallbackLog.triggered = true;
  fallbackLog.reason = reasons.join('; ');

  console.log(`[fallback] Triggering Gemini fallback: ${fallbackLog.reason}`);

  // Call Gemini
  const geminiResult = await callGemini(parseLog.normalized, parseResult.unmatched);

  if (!geminiResult || geminiResult.foods.length === 0) {
    console.log('[fallback] Gemini returned no usable results');
    fallbackLog.gemini_called = true;
    return { result: parseResult, fallbackLog };
  }

  fallbackLog.gemini_called = true;
  fallbackLog.gemini_response = geminiResult.foods.map((f) => ({
    original_text: f.original_text,
    suggested_food_id: f.suggested_food_id,
    suggested_name: f.suggested_name,
  }));

  console.log('[fallback] Gemini suggestions:', JSON.stringify(fallbackLog.gemini_response));

  // Remap unmatched items using Gemini suggestions
  const updatedItems = [...parseResult.items];
  const resolvedUnmatched: Set<string> = new Set();

  for (const geminiFood of geminiResult.foods) {
    // Find the corresponding unmatched item in parseResult
    const unmatchedIndex = updatedItems.findIndex(
      (item) => !item.matched && matchesOriginalText(item, geminiFood.original_text)
    );

    if (unmatchedIndex === -1) continue;

    // Try to map Gemini's suggestion to our dictionary
    const mapped = mapToLocalDictionary(geminiFood, dictionary);
    if (!mapped) continue;

    const oldItem = updatedItems[unmatchedIndex];
    const newItem: ParsedItem = {
      food_id: mapped.food.id,
      name: mapped.food.name,
      qty: geminiFood.quantity || oldItem.qty,
      unit: oldItem.unit,
      grams: oldItem.grams,
      matched: true,
    };

    updatedItems[unmatchedIndex] = newItem;
    resolvedUnmatched.add(oldItem.name);

    fallbackLog.remapped_items.push({
      from: oldItem.name,
      to: mapped.food.name,
      food_id: mapped.food.id,
    });

    console.log(`[fallback] Remapped: "${oldItem.name}" → "${mapped.food.name}" (${mapped.food.id})`);
  }

  // Rebuild ParseResult
  const newUnmatched = parseResult.unmatched.filter((u) => !resolvedUnmatched.has(u));
  const matchedCount = updatedItems.filter((i) => i.matched).length;
  const newConfidence = updatedItems.length > 0
    ? Math.round((matchedCount / updatedItems.length) * 100) / 100
    : 0;

  const newMethod: ParseResult['method'] = fallbackLog.remapped_items.length > 0 ? 'hybrid' : parseResult.method;
  fallbackLog.final_method = newMethod;

  const result: ParseResult = {
    items: updatedItems,
    confidence: Math.max(parseResult.confidence, newConfidence),
    method: newMethod,
    unmatched: newUnmatched,
  };

  console.log(`[fallback] Result: method=${newMethod}, confidence=${result.confidence}, remapped=${fallbackLog.remapped_items.length}`);

  return { result, fallbackLog };
}

function matchesOriginalText(item: ParsedItem, geminiText: string): boolean {
  const itemNormalized = item.name.toLowerCase().trim();
  const geminiNormalized = geminiText.toLowerCase().trim();

  return (
    itemNormalized === geminiNormalized ||
    itemNormalized.includes(geminiNormalized) ||
    geminiNormalized.includes(itemNormalized)
  );
}

function mapToLocalDictionary(
  geminiFood: { suggested_food_id: string | null; suggested_name: string; confidence: number },
  dictionary: FoodEntry[],
): { food: FoodEntry } | null {
  // Strategy 1: Gemini provided a food_id — verify it exists in our dictionary
  if (geminiFood.suggested_food_id) {
    const directMatch = dictionary.find((f) => f.id === geminiFood.suggested_food_id);
    if (directMatch) {
      return { food: directMatch };
    }
  }

  // Strategy 2: Use the suggested_name and run it through our matcher
  if (geminiFood.suggested_name) {
    const matchResult = matchFood(geminiFood.suggested_name, dictionary);
    if (matchResult.food && matchResult.confidence >= 0.6) {
      return { food: matchResult.food };
    }
  }

  // Could not map to local dictionary — do not trust Gemini blindly
  return null;
}
