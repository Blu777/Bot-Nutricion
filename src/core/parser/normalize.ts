// ─── Input Normalization Layer ────────────────────────────────
// Runs BEFORE tokenization. Cleans up messy real-world Argentine Spanish input.

// Slang → canonical form (post-accent-removal, so keys are accent-free)
const SLANG_MAP: Record<string, string> = {
  'mila': 'milanesa',
  'milas': 'milanesas',
  'milanga': 'milanesa',
  'milangas': 'milanesas',
  'napo': 'napolitana',
  'pure': 'pure de papa',
  'facu': 'facturas',
  'factu': 'facturas',
  'hambur': 'hamburguesa',
  'birra': 'cerveza',
  'pecha': 'pechuga',
  'pechugas': 'pechugas de pollo',
  'bondi': 'boniato',
  'scoop': 'scoop de proteina',
  'prote': 'proteina',
  'lata': 'atun en lata',
};

// Compound food phrases that should NOT be split by connectors
const COMPOUND_PHRASES: string[] = [
  'cafe con leche',
  'jamon y queso',
  'jamon queso',
  'dulce de leche',
  'arroz con leche',
  'pan con manteca',
  'pan con queso',
  'fideos con tuco',
  'fideos con salsa',
  'tarta de jamon y queso',
  'tarta de jamon',
  'empanada de carne',
  'empanada de jamon y queso',
  'guiso de lentejas',
  'milanesa de pollo',
  'milanesa de carne',
  'pure de papa',
  'ensalada de frutas',
  'atun en lata',
  'huevos revueltos',
];

export function normalizeInput(raw: string): string {
  let text = raw;

  // 1. Lowercase
  text = text.toLowerCase();

  // 2. Remove accents
  text = removeAccents(text);

  // 3. Remove punctuation noise (keep commas for splitting, keep dots in numbers)
  text = text.replace(/[¿¡!?;:()[\]{}""''""]/g, '');

  // 4. Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // 5. Expand slang (word-boundary aware)
  text = expandSlang(text);

  return text;
}

export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function expandSlang(text: string): string {
  const words = text.split(' ');
  const result: string[] = [];

  for (const word of words) {
    const replacement = SLANG_MAP[word];
    if (replacement) {
      result.push(replacement);
    } else {
      result.push(word);
    }
  }

  return result.join(' ');
}

export function isCompoundPhrase(text: string): boolean {
  const normalized = removeAccents(text.toLowerCase().trim());
  return COMPOUND_PHRASES.some((phrase) => normalized.includes(phrase));
}

export function getCompoundPhrases(): string[] {
  return COMPOUND_PHRASES;
}
