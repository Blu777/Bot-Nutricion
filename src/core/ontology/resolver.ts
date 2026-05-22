// ─── Ontology Resolver ────────────────────────────────────────
// PIPELINE (deterministic, no free-text estimation):
//
//   Step 1 — Extract preparation method from food text
//   Step 2 — Normalize food text to concept alias
//   Step 3 — Resolve in order:
//             a) Concept + specific preparationProfile
//             b) Concept base profile
//             c) Category fallback (conservative, never invented)
//   Step 4 — Compute final macros deterministically
//   Step 5 — Validate against guardrails
//
// NEVER invents nutrition values. NEVER uses free-text estimation.

import { removeAccents } from '../parser/normalize.js';
import { FOOD_CONCEPTS, PREPARATION_METHODS, PREP_ALIAS_MAP, CONCEPT_ALIAS_MAP } from './graph.js';
import { validateAgainstGuardrails } from './guardrails.js';
import type { NutritionalProfile, OntologyResolutionResult, OntologyLookupInput } from './types.js';

// ─── Category fallbacks (conservative, USDA-based) ────────────
// Used ONLY when no concept match is found.
// Values are conservative lower-range estimates, not inflated.
const CATEGORY_FALLBACKS: Record<string, { calories: number; protein: number; carbs: number; fats: number; source: string }> = {
  carnes:         { calories: 180, protein: 22, carbs: 0,    fats: 9,   source: 'Fallback conservador — carnes cocidas (USDA range)' },
  pescados:       { calories: 100, protein: 20, carbs: 0,    fats: 2,   source: 'Fallback conservador — pescados cocidos (USDA range)' },
  huevos:         { calories: 155, protein: 13, carbs: 1,    fats: 11,  source: 'Fallback conservador — huevos cocidos (USDA)' },
  lacteos:        { calories: 80,  protein: 5,  carbs: 6,    fats: 4,   source: 'Fallback conservador — lácteos (USDA range)' },
  carbohidratos:  { calories: 120, protein: 3,  carbs: 25,   fats: 0.5, source: 'Fallback conservador — carbohidratos cocidos (USDA range)' },
  verduras:       { calories: 30,  protein: 2,  carbs: 5,    fats: 0.3, source: 'Fallback conservador — verduras cocidas (USDA range)' },
  frutas:         { calories: 60,  protein: 0.5,carbs: 14,   fats: 0.2, source: 'Fallback conservador — frutas frescas (USDA range)' },
  legumbres:      { calories: 110, protein: 9,  carbs: 18,   fats: 0.5, source: 'Fallback conservador — legumbres cocidas (USDA range)' },
  comidas:        { calories: 200, protein: 10, carbs: 20,   fats: 10,  source: 'Fallback conservador — comidas compuestas (estimado conservador)' },
  snacks:         { calories: 150, protein: 2,  carbs: 20,   fats: 6,   source: 'Fallback conservador — snacks (estimado conservador)' },
  bebidas:        { calories: 40,  protein: 0,  carbs: 10,   fats: 0,   source: 'Fallback conservador — bebidas (estimado conservador)' },
  panaderia:      { calories: 300, protein: 7,  carbs: 50,   fats: 8,   source: 'Fallback conservador — panadería (USDA range)' },
};

// ─── Keyword-based food estimator ─────────────────────────────
// Used when a food is completely unknown. Matches keywords to realistic
// per-100g profiles. Never invents values — uses USDA/INTA references.
interface KeywordProfile {
  keywords: string[];
  profile: { calories: number; protein: number; carbs: number; fats: number; source: string };
}
const KEYWORD_PROFILES: KeywordProfile[] = [
  { keywords: ['palta', 'aguacate', 'avocado'], profile: { calories: 160, protein: 2, carbs: 8.5, fats: 14.7, source: 'Heurística USDA #171706 — palta' } },
  { keywords: ['manteca', 'mantequilla', 'butter'], profile: { calories: 720, protein: 0.5, carbs: 0, fats: 81, source: 'Heurística USDA #01001 — manteca' } },
  { keywords: ['aceite'], profile: { calories: 884, protein: 0, carbs: 0, fats: 100, source: 'Heurística USDA #04053 — aceite' } },
  { keywords: ['queso', 'crema', 'mozzarella', 'cheddar', 'parmesano'], profile: { calories: 350, protein: 22, carbs: 2, fats: 28, source: 'Heurística USDA #01057 — queso' } },
  { keywords: ['jamon', 'ham', 'jamón', 'jamoncito'], profile: { calories: 145, protein: 21, carbs: 2, fats: 6, source: 'Heurística USDA #10149 — jamón cocido' } },
  { keywords: ['pan', 'tostada', 'tostado', 'baguette', 'brioche', 'focaccia'], profile: { calories: 280, protein: 9.5, carbs: 52, fats: 3.5, source: 'Heurística USDA #18069 — pan tostado' } },
  { keywords: ['medialuna', 'croissant', 'factura', 'donut', 'masa', 'facturas'], profile: { calories: 360, protein: 6, carbs: 44, fats: 18, source: 'Heurística USDA #18253 — medialuna' } },
  { keywords: ['carne', 'bife', 'milanesa', 'vacio', 'asado', 'churrasco', 'bondiola', 'matambre', 'filete'], profile: { calories: 200, protein: 25, carbs: 0, fats: 12, source: 'Heurística USDA — carne vacuna' } },
  { keywords: ['pollo', 'pechuga', 'pata', 'muslo', 'suprema'], profile: { calories: 165, protein: 31, carbs: 0, fats: 3.6, source: 'Heurística USDA #171477 — pollo' } },
  { keywords: ['pescado', 'merluza', 'atun', 'atún', 'salmon', 'trucha', 'lenguado'], profile: { calories: 120, protein: 22, carbs: 0, fats: 3, source: 'Heurística USDA — pescado cocido' } },
  { keywords: ['huevo', 'huevos', 'clara', 'yema', 'huevito'], profile: { calories: 155, protein: 13, carbs: 1.1, fats: 10.6, source: 'Heurística USDA #748967 — huevo' } },
  { keywords: ['arroz', 'risotto'], profile: { calories: 130, protein: 2.7, carbs: 28.2, fats: 0.3, source: 'Heurística USDA #168878 — arroz' } },
  { keywords: ['fideo', 'pasta', 'spaghetti', 'tallarin', 'ravioles', 'noquis', 'gnocchi', 'lasagna', 'canelones'], profile: { calories: 140, protein: 5, carbs: 27, fats: 1.2, source: 'Heurística USDA #20121 — pasta cocida' } },
  { keywords: ['papa', 'pure', 'puré', 'batata', 'boniato', 'papitas'], profile: { calories: 90, protein: 2, carbs: 20, fats: 0.2, source: 'Heurística USDA #170093 — papa' } },
  { keywords: ['verdura', 'lechuga', 'tomate', 'zanahoria', 'zapallo', 'espinaca', 'brocoli', 'acelga', 'remolacha', 'rabanito'], profile: { calories: 30, protein: 2, carbs: 5, fats: 0.3, source: 'Heurística USDA — verduras cocidas' } },
  { keywords: ['fruta', 'banana', 'manzana', 'naranja', 'pera', 'uva', 'melon', 'sandia', 'kiwi', 'frutilla', 'arandano'], profile: { calories: 60, protein: 0.5, carbs: 14, fats: 0.2, source: 'Heurística USDA — frutas frescas' } },
  { keywords: ['lenteja', 'poroto', 'garbanzo', 'arveja', 'haba', 'soja'], profile: { calories: 115, protein: 9, carbs: 18, fats: 0.5, source: 'Heurística USDA — legumbres cocidas' } },
  { keywords: ['yogur', 'yogurt', 'yogourt'], profile: { calories: 97, protein: 9, carbs: 3.6, fats: 5, source: 'Heurística USDA #170903 — yogur griego' } },
  { keywords: ['leche', 'latte'], profile: { calories: 61, protein: 3.2, carbs: 4.8, fats: 3.3, source: 'Heurística USDA #746782 — leche entera' } },
  { keywords: ['azucar', 'miel', 'dulce', 'mermelada', 'jarabe', 'caramelo', 'chocolate', 'chocolat'], profile: { calories: 400, protein: 2, carbs: 85, fats: 10, source: 'Heurística USDA — azúcar/dulce' } },
  { keywords: ['galletita', 'galleta', 'cookie', 'pepa', 'cracker'], profile: { calories: 450, protein: 6, carbs: 67, fats: 17, source: 'Heurística USDA #18192 — galletitas' } },
  { keywords: ['alfajor', 'brownie', 'torta', 'budin', 'muffin', 'cheesecake'], profile: { calories: 420, protein: 5, carbs: 58, fats: 20, source: 'Heurística conservador — pastel' } },
  { keywords: ['cerveza', 'birra', 'vino', 'whisky', 'vodka', 'ron', 'gin', 'fernet', 'campari'], profile: { calories: 43, protein: 0.3, carbs: 3.6, fats: 0, source: 'Heurística USDA #14003 — bebidas alcohólicas' } },
  { keywords: ['gaseosa', 'coca', 'pepsi', 'sprite', 'jugo', 'juguito'], profile: { calories: 40, protein: 0, carbs: 10, fats: 0, source: 'Heurística USDA #14400 — gaseosa/jugo' } },
  { keywords: ['cafe', 'café', 'mate', 'te', 'té', 'infusion', 'infusión', 'chocolatada'], profile: { calories: 5, protein: 0, carbs: 1, fats: 0, source: 'Heurística USDA #14209 — infusiones' } },
];

export function estimateUnknownFood(
  foodName: string,
  grams: number,
): { calories: number; protein: number; carbs: number; fats: number; source: string } | null {
  const normalized = normalizeText(foodName);
  for (const { keywords, profile } of KEYWORD_PROFILES) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        const m = grams / 100;
        return {
          calories: profile.calories * m,
          protein:  profile.protein  * m,
          carbs:    profile.carbs    * m,
          fats:     profile.fats     * m,
          source:   `${profile.source} (heurística por palabra clave "${kw}")`,
        };
      }
    }
  }
  return null;
}

export function inferCategoryFromName(foodName: string): string | null {
  const normalized = normalizeText(foodName);
  const categoryKeywords: Array<{ cat: string; keywords: string[] }> = [
    { cat: 'carnes', keywords: ['carne', 'bife', 'milanesa', 'vacio', 'asado', 'churrasco', 'bondiola', 'matambre', 'pollo', 'pechuga', 'pata', 'muslo', 'chorizo', 'salchicha', 'jamon', 'panceta'] },
    { cat: 'pescados', keywords: ['pescado', 'merluza', 'atun', 'atún', 'salmon', 'trucha', 'lenguado'] },
    { cat: 'huevos', keywords: ['huevo', 'huevos', 'clara', 'yema'] },
    { cat: 'lacteos', keywords: ['leche', 'yogur', 'yogurt', 'queso', 'ricota', 'manteca', 'mantequilla'] },
    { cat: 'carbohidratos', keywords: ['arroz', 'fideo', 'pasta', 'papa', 'pure', 'puré', 'batata', 'pan', 'tostada', 'avena', 'polenta', 'noquis', 'ñoquis', 'gnocchi'] },
    { cat: 'verduras', keywords: ['verdura', 'lechuga', 'tomate', 'zanahoria', 'zapallo', 'espinaca', 'brocoli', 'acelga', 'remolacha', 'palta', 'aguacate'] },
    { cat: 'frutas', keywords: ['fruta', 'banana', 'manzana', 'naranja', 'pera', 'uva', 'melon', 'sandia', 'kiwi', 'frutilla'] },
    { cat: 'legumbres', keywords: ['lenteja', 'poroto', 'garbanzo', 'arveja', 'haba', 'soja'] },
    { cat: 'panaderia', keywords: ['medialuna', 'croissant', 'factura', 'donut', 'masa', 'torta', 'budin'] },
    { cat: 'snacks', keywords: ['galletita', 'galleta', 'alfajor', 'pepa', 'cracker', 'chocolate', 'brownie'] },
    { cat: 'bebidas', keywords: ['cerveza', 'birra', 'vino', 'gaseosa', 'coca', 'pepsi', 'jugo', 'cafe', 'café', 'mate', 'te', 'té', 'agua'] },
  ];
  for (const { cat, keywords } of categoryKeywords) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) return cat;
    }
  }
  return null;
}

// ─── Step 1: Extract preparation method ───────────────────────
export function extractPreparation(foodText: string): { cleanText: string; prepId: string | null } {
  const normalized = normalizeText(foodText);

  // Try longest alias first (multi-word preps like "a la plancha")
  const sortedEntries = [...PREP_ALIAS_MAP.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [alias, prepId] of sortedEntries) {
    const result = removeWordSequence(normalized, alias);
    if (result && result.length > 0) {
      return { cleanText: result, prepId };
    }
  }

  // No explicit prep found — check for implicit prep in compound name
  const implicitPrepMap: Array<[RegExp, string]> = [
    [/\bduro\b|\bdura\b/, 'hervido'],
    [/\bfrito\b|\bfrita\b/, 'frito'],
    [/\brevuelto\b|\brevuelta\b/, 'revuelto'],
    [/\bhervido\b|\bhervida\b/, 'hervido'],
    [/\bhorno\b/, 'horno'],
    [/\bgrillado\b|\bgrillada\b|\bplancha\b/, 'horno'],
    [/\bempanado\b|\bempanada\b|\bapanado\b/, 'empanado'],
  ];

  for (const [pattern, prepId] of implicitPrepMap) {
    if (pattern.test(normalized)) {
      const cleanText = normalized.replace(pattern, '').replace(/\s+/g, ' ').trim();
      if (cleanText.length > 0) {
        return { cleanText, prepId };
      }
      return { cleanText: normalized, prepId };
    }
  }

  return { cleanText: normalized, prepId: null };
}

function removeWordSequence(text: string, sequence: string): string | null {
  const textWords = text.split(/\s+/);
  const seqWords = sequence.split(/\s+/);

  for (let i = 0; i <= textWords.length - seqWords.length; i++) {
    const slice = textWords.slice(i, i + seqWords.length);
    if (slice.join(' ') === sequence) {
      const before = textWords.slice(0, i);
      const after = textWords.slice(i + seqWords.length);
      const result = [...before, ...after].join(' ').trim();
      return result || null;
    }
  }
  return null;
}

// ─── Step 2: Find concept by alias ────────────────────────────
export function findConcept(foodText: string): { conceptId: string | null; matchedAlias: string | null } {
  const normalized = normalizeText(foodText);

  // Exact match
  const exactId = CONCEPT_ALIAS_MAP.get(normalized);
  if (exactId) return { conceptId: exactId, matchedAlias: normalized };

  // Partial match — input contains a concept alias or vice versa
  // Sort by alias length descending to prefer longer (more specific) matches
  const sortedAliases = [...CONCEPT_ALIAS_MAP.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [alias, conceptId] of sortedAliases) {
    if (alias.length < 3) continue;
    if (normalized === alias) return { conceptId, matchedAlias: alias };
    if (normalized.includes(alias) && alias.length / normalized.length >= 0.4) {
      return { conceptId, matchedAlias: alias };
    }
    if (alias.includes(normalized) && normalized.length / alias.length >= 0.4) {
      return { conceptId, matchedAlias: alias };
    }
  }

  return { conceptId: null, matchedAlias: null };
}

// ─── Step 3+4: Compute profile deterministically ──────────────
function computeNutrition(
  profile: NutritionalProfile,
  grams: number,
): { calories: number; protein: number; carbs: number; fats: number } {
  const base100g = profile.per === '100g'
    ? profile
    : {
        calories: (profile.calories / (profile.portionGrams ?? grams)) * 100,
        protein:  (profile.protein  / (profile.portionGrams ?? grams)) * 100,
        carbs:    (profile.carbs    / (profile.portionGrams ?? grams)) * 100,
        fats:     (profile.fats     / (profile.portionGrams ?? grams)) * 100,
      };

  const multiplier = grams / 100;
  return {
    calories: base100g.calories * multiplier,
    protein:  base100g.protein  * multiplier,
    carbs:    base100g.carbs    * multiplier,
    fats:     base100g.fats     * multiplier,
  };
}

// ─── Main resolver ─────────────────────────────────────────────
export function resolveOntology(input: OntologyLookupInput): OntologyResolutionResult | null {
  const { foodText, qty, unit } = input;

  // Step 1: Extract preparation
  const { cleanText, prepId } = extractPreparation(foodText);

  // Step 2: Find concept
  const { conceptId } = findConcept(cleanText) ?? findConcept(foodText);

  if (!conceptId) {
    return null;
  }

  const concept = FOOD_CONCEPTS[conceptId];
  if (!concept) return null;

  // Determine grams to compute for
  let grams: number;
  if (input.grams) {
    grams = input.grams;
  } else if (unit === 'g' || unit === 'ml') {
    grams = qty;
  } else {
    // Portion-based: use canonical portion size from profile
    grams = (concept.baseProfile.portionGrams ?? 100) * qty;
  }

  // Step 3: Select profile (preparation-specific > base)
  let profile: NutritionalProfile;
  let resolutionPath: OntologyResolutionResult['resolutionPath'];

  if (prepId && concept.preparationProfiles?.[prepId]) {
    profile = concept.preparationProfiles[prepId];
    resolutionPath = 'concept_preparation';
  } else {
    profile = concept.baseProfile;
    resolutionPath = prepId ? 'concept_base' : 'concept_base';
  }

  // Step 4: Compute deterministically
  const computed = computeNutrition(profile, grams);

  // Step 5: Validate guardrails
  const guardrailResult = validateAgainstGuardrails(
    conceptId,
    profile,
    computed.calories,
    computed.protein,
    grams,
    concept.guardrails,
  );

  return {
    conceptId,
    conceptName: concept.name,
    preparationId: prepId,
    profile,
    resolutionPath,
    guardrailWarnings: guardrailResult.warnings,
    source: profile.source,
    grams,
    computed,
  };
}

// ─── Category fallback (last resort) ──────────────────────────
// Used when the food is NOT in the ontology but we know its category from the dictionary.
// Returns conservative estimates — NEVER inflated.
export function resolveCategoryFallback(
  category: string | null,
  grams: number,
  foodName?: string,
): { calories: number; protein: number; carbs: number; fats: number; source: string } | null {
  const cat = (category ?? inferCategoryFromName(foodName ?? '') ?? '').toLowerCase();
  const fallback = CATEGORY_FALLBACKS[cat];
  if (!fallback) return null;

  const multiplier = grams / 100;
  return {
    calories: fallback.calories * multiplier,
    protein:  fallback.protein  * multiplier,
    carbs:    fallback.carbs    * multiplier,
    fats:     fallback.fats     * multiplier,
    source:   fallback.source,
  };
}

// ─── Utility ──────────────────────────────────────────────────
function normalizeText(text: string): string {
  return removeAccents(text).toLowerCase().trim().replace(/\s+/g, ' ');
}
