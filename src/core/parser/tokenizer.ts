import { getCompoundPhrases, removeAccents } from './normalize.js';
import { resolveQuantity, assumeQuantityForPlural } from './quantity-engine.js';

export interface Token {
  quantity: number;
  unit: 'portion' | 'g' | 'ml' | 'kg';
  grams?: number;
  foodText: string;
  assumedQty?: boolean;        // true si qty fue inferida, no explícita
  pluralWarning?: string;      // mensaje para mostrar al usuario
}

// Input is ALREADY normalized (lowercase, no accents, slang expanded)
export function tokenize(input: string): Token[] {
  const segments = splitIntoSegments(input);
  const tokens: Token[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const token = parseSegment(trimmed);
    if (token && token.foodText.length > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}

function splitIntoSegments(text: string): string[] {
  // 1. Split on commas first
  const commaParts = text.split(',').map((s) => s.trim()).filter(Boolean);

  // 2. For each comma-part, split on " y " and " con " (respecting compounds)
  const segments: string[] = [];
  for (const part of commaParts) {
    segments.push(...splitByConnectors(part));
  }

  return segments;
}

function splitByConnectors(text: string): string[] {
  // Protect compound phrases by replacing their connectors with placeholders
  const compounds = getCompoundPhrases();
  let protected_ = text;
  const placeholders: Array<{ placeholder: string; original: string }> = [];

  for (const phrase of compounds) {
    const normalizedPhrase = removeAccents(phrase.toLowerCase());
    if (protected_.includes(normalizedPhrase)) {
      const placeholder = `__COMPOUND_${placeholders.length}__`;
      placeholders.push({ placeholder, original: normalizedPhrase });
      protected_ = protected_.replace(normalizedPhrase, placeholder);
    }
  }

  // Split on " y " and " con " as food separators
  const parts = protected_.split(/\s+(?:y|con)\s+/).map((s) => s.trim()).filter(Boolean);

  // Restore compound phrases
  const restored = parts.map((part) => {
    let result = part;
    for (const { placeholder, original } of placeholders) {
      result = result.replace(placeholder, original);
    }
    return result;
  });

  return restored;
}

function parseSegment(segment: string): Token | null {
  if (!segment) return null;

  let foodText = segment.trim();
  if (!foodText) return null;

  // Strip leading articles
  foodText = foodText.replace(/^(el|la|las|los)\s+/i, '');

  // Try the quantity engine first
  const resolved = resolveQuantity(foodText);
  if (resolved) {
    // Strip any remaining articles from the food text
    const cleanFoodText = resolved.remainingText.replace(/^(el|la|las|los)\s+/i, '');
    return {
      quantity: resolved.quantity,
      unit: resolved.unit,
      grams: resolved.grams,
      foodText: cleanFoodText,
      assumedQty: resolved.isAssumed,
      pluralWarning: resolved.warning,
    };
  }

  // No quantity detected — strip leftover connectors and check implicit plurals
  foodText = foodText.replace(/^(?:de|del|al|a la|a el)\s+/i, '');

  const assumed = assumeQuantityForPlural(foodText);
  if (assumed) {
    return {
      quantity: assumed.quantity,
      unit: 'portion',
      foodText,
      assumedQty: true,
      pluralWarning: assumed.warning,
    };
  }

  return { quantity: 1, unit: 'portion', foodText };
}
