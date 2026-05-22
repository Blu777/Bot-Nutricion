import { normalizeInput } from './normalize.js';
import { tokenize } from './tokenizer.js';
import { matchFood } from './matcher.js';
import type { ParseResult, ParsedItem, FoodEntry } from '../../types/index.js';

export interface ParseLog {
  raw_input: string;
  normalized: string;
  tokens: Array<{ foodText: string; quantity: number; unit: string }>;
  matches: Array<{ input: string; food_id: string | null; confidence: number }>;
  overall_confidence: number;
}

export function parseMealText(text: string, dictionary: FoodEntry[]): { result: ParseResult; log: ParseLog } {
  // 1. Normalize input
  const normalized = normalizeInput(text);

  // 2. Tokenize
  const tokens = tokenize(normalized);

  // 3. Match each token
  const items: ParsedItem[] = [];
  const unmatched: string[] = [];
  const quantity_warnings: string[] = [];
  let totalConfidence = 0;
  const matchLogs: ParseLog['matches'] = [];

  for (const token of tokens) {
    const match = matchFood(token.foodText, dictionary);

    matchLogs.push({
      input: token.foodText,
      food_id: match.food?.id ?? null,
      confidence: match.confidence,
    });

    if (match.food) {
      items.push({
        food_id: match.food.id,
        name: match.food.name,
        qty: token.quantity,
        unit: token.unit,
        grams: token.grams,
        matched: true,
      });
      totalConfidence += match.confidence;
    } else {
      items.push({
        food_id: `unknown_${token.foodText.replace(/\s+/g, '_')}`,
        name: token.foodText,
        qty: token.quantity,
        unit: token.unit,
        grams: token.grams,
        matched: false,
      });
      unmatched.push(token.foodText);
    }

    if (token.pluralWarning) {
      quantity_warnings.push(token.pluralWarning);
    }
  }

  const confidence = tokens.length > 0
    ? Math.round((totalConfidence / tokens.length) * 100) / 100
    : 0;

  const result: ParseResult = {
    items,
    confidence,
    method: 'dictionary',
    unmatched,
    quantity_warnings,
  };

  const log: ParseLog = {
    raw_input: text,
    normalized,
    tokens: tokens.map((t) => ({ foodText: t.foodText, quantity: t.quantity, unit: t.unit })),
    matches: matchLogs,
    overall_confidence: confidence,
  };

  return { result, log };
}
