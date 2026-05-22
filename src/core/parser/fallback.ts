// ─── Gemini Fallback Layer ────────────────────────────────────
// Runs AFTER the deterministic parser.
// Only triggers when confidence < 0.7 OR unknown items exist.
// Maps Gemini suggestions back to the local food dictionary.
// NEVER trusts Gemini for nutrition — only for food identification.

import { callGemini } from './gemini.js';
import { matchFood } from './matcher.js';
import { isRateLimited, markGeminiCall, getCachedResult, setCachedResult } from './gemini-limiter.js';
import { logger } from '../../lib/logger.js';
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
  userId?: string,
  requestId?: string,
): Promise<{ result: ParseResult; fallbackLog: FallbackLog }> {
  const ctx = { request_id: requestId, user_id: userId };

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
    return { result: parseResult, fallbackLog };
  }

  // Determine reason
  const reasons: string[] = [];
  if (lowConfidence) reasons.push(`confidence=${parseResult.confidence} < ${CONFIDENCE_THRESHOLD}`);
  if (hasUnmatched) reasons.push(`unmatched=[${parseResult.unmatched.join(', ')}]`);

  fallbackLog.triggered = true;
  fallbackLog.reason = reasons.join('; ');

  logger.info('fallback', 'fallback_triggered', fallbackLog.reason, ctx);

  // Rate limiting check
  if (userId && isRateLimited(userId)) {
    logger.warn('fallback', 'rate_limited', `Skipping Gemini for user ${userId}`, ctx);
    return { result: parseResult, fallbackLog };
  }

  // Check cache
  const cached = getCachedResult(parseLog.normalized);
  if (cached) {
    logger.debug('fallback', 'cache_hit', 'Using cached Gemini result', ctx);
    const geminiResult = cached as Awaited<ReturnType<typeof callGemini>>;
    if (geminiResult && geminiResult.foods.length > 0) {
      fallbackLog.gemini_called = false;
      return applyGeminiMapping(geminiResult, parseResult, dictionary, fallbackLog, ctx);
    }
    return { result: parseResult, fallbackLog };
  }

  // Call Gemini
  if (userId) markGeminiCall(userId);
  const geminiResult = await callGemini(parseLog.normalized, parseResult.unmatched);

  setCachedResult(parseLog.normalized, geminiResult);

  if (!geminiResult || geminiResult.foods.length === 0) {
    logger.warn('fallback', 'gemini_empty', 'Gemini returned no usable results', ctx);
    fallbackLog.gemini_called = true;
    return { result: parseResult, fallbackLog };
  }

  fallbackLog.gemini_called = true;
  return applyGeminiMapping(geminiResult, parseResult, dictionary, fallbackLog, ctx);
}

function applyGeminiMapping(
  geminiResult: NonNullable<Awaited<ReturnType<typeof callGemini>>>,
  parseResult: ParseResult,
  dictionary: FoodEntry[],
  fallbackLog: FallbackLog,
  ctx: { request_id?: string; user_id?: string },
): { result: ParseResult; fallbackLog: FallbackLog } {
  fallbackLog.gemini_response = geminiResult.foods.map((f) => ({
    original_text: f.original_text,
    suggested_food_id: f.suggested_food_id,
    suggested_name: f.suggested_name,
  }));

  logger.debug('fallback', 'gemini_suggestions', `${geminiResult.foods.length} suggestions received`, {
    ...ctx,
    meta: { suggestions: fallbackLog.gemini_response },
  });

  // Remap unmatched items using Gemini suggestions
  const updatedItems = [...parseResult.items];
  const resolvedUnmatched: Set<string> = new Set();

  for (const geminiFood of geminiResult.foods) {
    const unmatchedIndex = updatedItems.findIndex(
      (item) => !item.matched && matchesOriginalText(item, geminiFood.original_text)
    );

    if (unmatchedIndex === -1) continue;

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

    logger.info('fallback', 'item_remapped', `"${oldItem.name}" → "${mapped.food.name}" (${mapped.food.id})`, ctx);
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
    quantity_warnings: parseResult.quantity_warnings,
  };

  logger.info('fallback', 'mapping_done', `method=${newMethod} confidence=${result.confidence} remapped=${fallbackLog.remapped_items.length}`, ctx);

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
