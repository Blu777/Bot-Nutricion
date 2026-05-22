// ─── Input Normalization Layer ────────────────────────────────
// Runs BEFORE tokenization. Cleans up messy real-world Argentine Spanish input.

// Slang → canonical form (post-accent-removal, so keys are accent-free)
const SLANG_MAP: Record<string, string> = {
  // Milanesa variants
  'mila': 'milanesa',
  'milas': 'milanesas',
  'milanga': 'milanesa',
  'milangas': 'milanesas',
  'milanesita': 'milanesa',
  'milanesitas': 'milanesas',
  'napo': 'napolitana',
  'napos': 'napolitanas',
  // Meats
  'chori': 'chorizo',
  'choris': 'chorizos',
  'pancho': 'salchicha',
  'panchos': 'salchichas',
  'bife': 'bife de chorizo',
  'churrasco': 'bife de chorizo',
  'pata': 'pata muslo de pollo',
  // Staples
  'pure': 'pure de papa',
  'ñoquis': 'noquis',
  'ravi': 'ravioles',
  'ravis': 'ravioles',
  'tortilla': 'tortilla de papa',
  // Dairy
  'dulce': 'dulce de leche',
  'ddl': 'dulce de leche',
  // Breakfast / snacks
  'facu': 'facturas',
  'factu': 'facturas',
  'tosta': 'tostadas',
  // Protein supplements
  'scoop': 'scoop de proteina',
  'prote': 'proteina',
  'whey': 'scoop de proteina',
  // Fish
  'lata': 'atun en lata',
  // Drinks
  'birra': 'cerveza',
  'coca': 'gaseosa',
  'juguito': 'jugo',
  // Poultry
  'pecha': 'pechuga',
  'pechugas': 'pechugas de pollo',
  'suprema': 'milanesa de pollo',
  'supremas': 'milanesas de pollo',
  // Burger
  'hambur': 'hamburguesa',
  'hamburgue': 'hamburguesa',
  // Cooking style → food mapping (orphan modifiers after con-split)
  'fritas': 'papas fritas',
  // Common spelling variants
  'spagueti': 'spaghetti',
  'espagueti': 'spaghetti',
  'espaguetis': 'spaghetti',
};

// Compound food phrases that should NOT be split by connectors
const COMPOUND_PHRASES: string[] = [
  // Drinks
  'cafe con leche',
  // Compound foods with connectors
  'jamon y queso',
  'jamon queso',
  'dulce de leche',
  'arroz con leche',
  'arroz con pollo',
  'pan con manteca',
  'pan con queso',
  'pan con jamon',
  'fideos con tuco',
  'fideos con salsa',
  'fideos con manteca',
  // Tarts & empanadas
  'tarta de jamon y queso',
  'tarta de jamon',
  'tarta de verdura',
  'tarta de pollo',
  'empanada de carne',
  'empanada de jamon y queso',
  'empanada de pollo',
  // Meats
  'milanesa de pollo',
  'milanesa de carne',
  'milanesa al horno',
  'mila de pollo',
  'bife de chorizo',
  'pata muslo de pollo',
  'pechuga de pollo',
  'pollo al horno',
  // Sides
  'pure de papa',
  'tortilla de papa',
  'ensalada de frutas',
  'ensalada de tomate',
  // Fish
  'atun en lata',
  // Eggs — preparation compounds must NOT be split
  'huevo duro',
  'huevo frito',
  'huevo revuelto',
  'huevos duros',
  'huevos fritos',
  'huevos revueltos',
  'huevo a caballo',
  // Chicken preparations
  'pollo frito',
  'pollo hervido',
  'pollo al horno',
  'pollo a la plancha',
  'pollo grillado',
  // Milanesa preparations
  'milanesa al horno',
  'milanesa frita',
  // Grains
  'guiso de lentejas',
  'guiso de arroz',
  // Dairy
  'queso rallado',
  'queso cremoso',
  // Drinks
  'jugo de naranja',
];

// Multi-word slang → canonical form (applied before single-word slang)
const MULTI_WORD_SLANG: Array<[string, string]> = [
  ['mila napo', 'milanesa napolitana'],
  ['milas napo', 'milanesas napolitanas'],
  ['mila de pollo', 'milanesa de pollo'],
  ['milas de pollo', 'milanesas de pollo'],
  ['mila al horno', 'milanesa al horno'],
  ['milas al horno', 'milanesas al horno'],
  ['huevo a caballo', 'huevo a caballo'],
  ['un par de', '2'],
  ['par de', '2'],
];

// Common food-context verbs to strip (users say "comí pollo", "almorcé milanesa")
const FOOD_VERBS = /^(comi|almorce|desayune|meriende|tome|cene|me comi|me clave|me mande|meti)\s+/;

export function normalizeInput(raw: string): string {
  let text = raw;

  // 1. Lowercase
  text = text.toLowerCase();

  // 2. Remove accents
  text = removeAccents(text);

  // 3. Remove punctuation noise (keep commas for splitting, keep dots in numbers)
  text = text.replace(/[¿¡!?;:()[\]{}""''""]/g, '');

  // 4. Normalize "+" as separator to ","
  text = text.replace(/\s*\+\s*/g, ', ');

  // 5. Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // 6. Strip leading food-context verbs ("comi pollo" → "pollo")
  text = text.replace(FOOD_VERBS, '');

  // 7. Expand multi-word slang first (order matters: longest first)
  text = expandMultiWordSlang(text);

  // 8. Expand single-word slang
  text = expandSlang(text);

  // 9. Strip diminutives: -ito/-ita/-itos/-itas → base word
  text = stripDiminutives(text);

  return text;
}

export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stripDiminutives(text: string): string {
  // Only strip when the base word is >= 4 chars (avoid mangling short words)
  // "pollito" → "pollo", "arrocito" → "arroz" won't work generically
  // So we use a targeted map for common diminutives
  const DIMINUTIVE_MAP: Record<string, string> = {
    'pollito': 'pollo',
    'pollitos': 'pollos',
    'arrocito': 'arroz',
    'pancito': 'pan',
    'pancitos': 'pan',
    'lechecita': 'leche',
    'huevito': 'huevo',
    'huevitos': 'huevos',
    'quesito': 'queso',
    'tomatito': 'tomate',
    'tomatitos': 'tomates',
    'cafecito': 'cafe con leche',
    'juguito': 'jugo',
    'galletita': 'galletitas',
    'galletitas': 'galletitas',
    'costelita': 'costilla',
    'fideos': 'fideos',
  };

  const words = text.split(' ');
  const result = words.map((w) => DIMINUTIVE_MAP[w] || w);
  return result.join(' ');
}

function expandMultiWordSlang(text: string): string {
  let result = text;
  for (const [pattern, replacement] of MULTI_WORD_SLANG) {
    if (result.includes(pattern)) {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
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
