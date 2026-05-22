import type { FoodEntry } from '../../types/index.js';
import { removeAccents } from './normalize.js';

export interface MatchResult {
  food: FoodEntry | null;
  confidence: number;
  originalText: string;
}

const MIN_MATCH_CONFIDENCE = 0.55;

export function matchFood(foodText: string, dictionary: FoodEntry[]): MatchResult {
  const normalized = normalize(foodText);
  if (!normalized) return { food: null, confidence: 0, originalText: foodText };

  // 1. Exact alias match (or exact name match)
  for (const food of dictionary) {
    if (normalize(food.name) === normalized) {
      return { food, confidence: 1.0, originalText: foodText };
    }
    for (const alias of food.aliases) {
      if (normalize(alias) === normalized) {
        return { food, confidence: 1.0, originalText: foodText };
      }
    }
  }

  // 2. Depluralized / singular match
  const variants = getVariants(normalized);
  for (const variant of variants) {
    for (const food of dictionary) {
      for (const alias of food.aliases) {
        if (normalize(alias) === variant) {
          return { food, confidence: 0.95, originalText: foodText };
        }
      }
      if (normalize(food.name) === variant) {
        return { food, confidence: 0.95, originalText: foodText };
      }
    }
  }

  // 3. Contains match (input contains alias or alias contains input)
  // Tightened: require minimum length >= 4, and length ratio >= 0.5 to avoid
  // false positives like "pan" matching inside "empanada"
  let bestPartial: { food: FoodEntry; confidence: number } | null = null;
  for (const food of dictionary) {
    for (const alias of food.aliases) {
      const normalizedAlias = normalize(alias);
      if (normalizedAlias === normalized) continue; // already checked

      // Input contains alias: "pollo grillado" contains "pollo"
      if (normalized.includes(normalizedAlias) && normalizedAlias.length >= 4) {
        const ratio = normalizedAlias.length / normalized.length;
        if (ratio < 0.4) continue; // alias is too small relative to input
        const conf = 0.7 + ratio * 0.15; // 0.7-0.85
        if (!bestPartial || conf > bestPartial.confidence) {
          bestPartial = { food, confidence: Math.min(conf, 0.85) };
        }
      }
      // Alias contains input: alias "pollo a la plancha" contains "pollo"
      else if (normalizedAlias.includes(normalized) && normalized.length >= 4) {
        const ratio = normalized.length / normalizedAlias.length;
        if (ratio < 0.4) continue; // input is too small relative to alias
        const conf = 0.6 + ratio * 0.2; // 0.6-0.8
        if (!bestPartial || conf > bestPartial.confidence) {
          bestPartial = { food, confidence: Math.min(conf, 0.8) };
        }
      }
    }
  }
  if (bestPartial) {
    return { food: bestPartial.food, confidence: bestPartial.confidence, originalText: foodText };
  }

  // 4. Levenshtein fuzzy match
  // Tightened: max distance ≤ 2 always, and distance must be < 30% of word length
  // This prevents "ensalada" (8) matching "empanada" (8) at distance 3
  let bestFuzzy: { food: FoodEntry; confidence: number; distance: number } | null = null;
  const maxDistance = normalized.length <= 5 ? 1 : 2;

  for (const food of dictionary) {
    const candidates = [...food.aliases, food.name];
    for (const candidate of candidates) {
      const normalizedCandidate = normalize(candidate);
      // Skip candidates with very different lengths
      if (Math.abs(normalized.length - normalizedCandidate.length) > maxDistance) continue;
      const dist = levenshtein(normalized, normalizedCandidate);
      if (dist <= maxDistance && dist < normalized.length * 0.3) {
        const confidence = Math.max(0.5, 0.85 - dist * 0.15);
        if (!bestFuzzy || dist < bestFuzzy.distance) {
          bestFuzzy = { food, confidence, distance: dist };
        }
      }
    }
  }
  if (bestFuzzy && bestFuzzy.confidence >= MIN_MATCH_CONFIDENCE) {
    return { food: bestFuzzy.food, confidence: bestFuzzy.confidence, originalText: foodText };
  }

  // 5. No match found
  return { food: null, confidence: 0.0, originalText: foodText };
}

function normalize(text: string): string {
  return removeAccents(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function getVariants(word: string): string[] {
  const variants = new Set<string>();

  // Single-word: depluralize using most-specific rule first
  const depluralized = depluralizeWord(word);
  if (depluralized && depluralized !== word) {
    variants.add(depluralized);
  }

  // Pluralize base forms
  if (!word.endsWith('s')) {
    variants.add(word + 's');
    if (/[nlrz]$/.test(word)) {
      variants.add(word + 'es');
    }
  }

  // Multi-word: depluralize each word individually
  const words = word.split(' ');
  if (words.length > 1) {
    const depluralizedWords = words.map((w) => depluralizeWord(w) ?? w);
    const variant = depluralizedWords.join(' ');
    if (variant !== word) {
      variants.add(variant);
    }
  }

  return [...variants].filter((v) => v !== word);
}

/**
 * Depluralizes a single Spanish word using ordered specificity.
 * Returns null if no depluralization applies.
 */
function depluralizeWord(word: string): string | null {
  if (!word.endsWith('s') || word.length <= 2) return null;

  // Most specific suffixes first
  if (word.endsWith('ines') && word.length > 5) {
    return word.slice(0, -3) + 'n'; // tallarines → tallarin, examenes → examen
  }
  if (word.endsWith('ones') && word.length > 4) {
    return word.slice(0, -2); // ratones → raton, porciones → porcion
  }
  if (word.endsWith('ces') && word.length > 3) {
    return word.slice(0, -2) + 'z'; // lapices → lapiz
  }
  if (word.endsWith('es') && word.length > 3) {
    return word.slice(0, -2); // flores → flor
  }
  if (word.endsWith('s') && word.length > 2) {
    return word.slice(0, -1); // manzanas → manzana, huevos → huevo
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Early exit for large differences
  if (Math.abs(m - n) > 3) return Math.max(m, n);

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}
