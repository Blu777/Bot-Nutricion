import { getCompoundPhrases, removeAccents } from './normalize.js';

export interface Token {
  quantity: number;
  unit: 'portion' | 'g' | 'ml' | 'kg';
  grams?: number;
  foodText: string;
  assumedQty?: boolean;        // true si qty fue inferida, no explícita
  pluralWarning?: string;      // mensaje para mostrar al usuario
}

// Unit aliases
const UNIT_MAP: Record<string, { unit: Token['unit']; gramsMultiplier?: number }> = {
  'g': { unit: 'g' },
  'gr': { unit: 'g' },
  'gramos': { unit: 'g' },
  'ml': { unit: 'ml' },
  'kg': { unit: 'kg', gramsMultiplier: 1000 },
  'kilo': { unit: 'kg', gramsMultiplier: 1000 },
};

// Word-to-number mappings (includes vague quantities)
const WORD_NUMBERS: Record<string, number> = {
  'un': 1, 'una': 1, 'uno': 1,
  'unos': 1, 'unas': 1,
  'algo': 1, 'poquito': 1, 'poco': 1,
  'medio': 0.5, 'media': 0.5,
  'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
  'chorro': 1, 'chorrito': 1,
  'gusto': 1, 'pizca': 1,
};

// Vague quantity phrases that should trigger a warning
const VAGUE_QUANTITY_PHRASES = ['a gusto', 'al gusto', 'un chorro de', 'una pizca de'];

// CORREGIDO 2026-05-22 — Plurales sin cantidad explícita
// ASSUME_TWO: plural donde la porción mínima razonable es 2
const ASSUME_TWO: string[] = [
  'medialunas', 'empanadas', 'croquetas',
  'nuggets', 'alitas',
  // 'tostadas' movido a ASK_QUANTITY: la porción del diccionario ya es ~2 tostadas
  // 'papas fritas' removido: ahora tiene entry propio (papas_fritas) con porción correcta
];

// ASK_QUANTITY: plural donde la cantidad varía demasiado para asumir
const ASK_QUANTITY: string[] = [
  'galletitas', 'facturas', 'alfajores', 'panchos',
  'hamburguesas', 'milanesas', 'huevos',
  'tostadas', // CORREGIDO 2026-05-22 — Fix #alta-4: movido desde ASSUME_TWO
];

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

  let quantity = 1;
  let unit: Token['unit'] = 'portion';
  let grams: number | undefined;
  let foodText = segment;

  // Strip leading articles that aren't quantity words: "el pollo", "la ensalada"
  foodText = foodText.replace(/^(el|la|las|los)\s+/i, '');

  // Pattern: "200g de pollo", "200 g de pollo", "200gr de pollo"
  const gramsMatch = foodText.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gramos|ml|kg|kilo)\s*(?:de\s+)?(.+)$/i);
  if (gramsMatch) {
    const amount = parseFloat(gramsMatch[1]);
    const unitStr = gramsMatch[2].toLowerCase();
    const unitInfo = UNIT_MAP[unitStr];

    if (unitInfo) {
      unit = unitInfo.unit;
      grams = unitInfo.gramsMultiplier ? amount * unitInfo.gramsMultiplier : amount;
      quantity = 1;
      foodText = gramsMatch[3].trim();
      return { quantity, unit, grams, foodText };
    }
  }

  // Pattern: "medio kilo de carne"
  const medioKiloMatch = foodText.match(/^medio\s+kilo\s*(?:de\s+)?(.+)$/i);
  if (medioKiloMatch) {
    return { quantity: 1, unit: 'kg', grams: 500, foodText: medioKiloMatch[1].trim() };
  }

  // Pattern: "2 milanesas" or "3 huevos" or "1.5 porciones"
  const numMatch = foodText.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (numMatch) {
    quantity = parseFloat(numMatch[1]);
    foodText = numMatch[2].trim();
    // Strip "porciones de", "porcion de" after number
    foodText = foodText.replace(/^(?:porciones?|porcion)\s+(?:de\s+)?/i, '');
    return { quantity, unit: 'portion', foodText };
  }

  // Pattern: word numbers — "una milanesa", "dos huevos", "unos fideos"
  const wordPattern = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join('|');
  const wordRegex = new RegExp(`^(${wordPattern})\\s+(.+)$`, 'i');
  const wordMatch = foodText.match(wordRegex);
  if (wordMatch) {
    const wordNum = WORD_NUMBERS[wordMatch[1].toLowerCase()];
    if (wordNum !== undefined) {
      quantity = wordNum;
      foodText = wordMatch[2].trim();
      // Strip "porciones de", "porcion de" after word number
      foodText = foodText.replace(/^(?:porciones?|porcion)\s+(?:de\s+)?/i, '');
      return { quantity, unit: 'portion', foodText };
    }
  }

  // No quantity detected — check for implicit plural before defaulting
  foodText = foodText.replace(/^(?:de|del|al|a la|a el)\s+/i, '');

  const foodLower = foodText.toLowerCase().trim();

  if (ASSUME_TWO.includes(foodLower)) {
    return {
      quantity: 2,
      unit: 'portion',
      foodText,
      assumedQty: true,
      pluralWarning: `Asumí 2 ${foodText}. ¿Fueron más o menos?`,
    };
  }

  if (ASK_QUANTITY.includes(foodLower)) {
    return {
      quantity: 1,
      unit: 'portion',
      foodText,
      assumedQty: true,
      pluralWarning: `¿Cuántas/os ${foodText} comiste? Registré 1 por ahora.`,
    };
  }

  // Detect vague quantity phrases
  for (const phrase of VAGUE_QUANTITY_PHRASES) {
    if (foodLower.includes(phrase)) {
      return {
        quantity: 1,
        unit: 'portion',
        foodText,
        assumedQty: true,
        pluralWarning: `La cantidad "${phrase}" es ambigua. Asumí 1 porción, podés ajustarla.`,
      };
    }
  }

  return { quantity: 1, unit: 'portion', foodText };
}
