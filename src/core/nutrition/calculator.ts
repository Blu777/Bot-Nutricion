import type { ParsedItem, NutritionValues, FoodEntry } from '../../types/index.js';
import { resolveOntology, resolveCategoryFallback, estimateUnknownFood } from '../ontology/resolver.js';
import { recordResolution, trackUnknownFoodResolution } from '../ontology/observability/collector.js';
import type { ResolutionPath, NutritionSource } from '../ontology/observability/types.js';

export function calculateMealNutrition(
  items: ParsedItem[],
  foodMap: Map<string, FoodEntry>,
  unknownEstimates?: Map<string, NutritionValues>,
): NutritionValues {
  const total: NutritionValues = { calories: 0, protein: 0, carbs: 0, fats: 0 };

  for (const item of items) {
    const nutrition = calculateItemNutrition(item, foodMap, unknownEstimates);
    total.calories += nutrition.calories;
    total.protein += nutrition.protein;
    total.carbs += nutrition.carbs;
    total.fats += nutrition.fats;
  }

  // Round all values
  total.calories = Math.round(total.calories);
  total.protein = Math.round(total.protein);
  total.carbs = Math.round(total.carbs);
  total.fats = Math.round(total.fats);

  return total;
}

export function calculateItemNutrition(
  item: ParsedItem,
  foodMap: Map<string, FoodEntry>,
  unknownEstimates?: Map<string, NutritionValues>,
): NutritionValues {
  const food = foodMap.get(item.food_id);

  // ── Determine effective gram weight ───────────────────────
  let grams: number;
  if (item.grams) {
    grams = item.grams;
  } else if (item.unit === 'g' || item.unit === 'ml') {
    grams = item.qty;
  } else {
    const portionGrams = food?.portion_size ?? 100;
    grams = portionGrams * item.qty;
  }

  // ── Path 1: Ontology resolver (deterministic, USDA-based) ─
  const ontologyResult = resolveOntology({
    foodText: item.name,
    grams,
    qty: item.qty,
    unit: item.unit,
  });

  if (ontologyResult) {
    const profile = ontologyResult.profile;
    const isPer100g = profile.per === '100g';
    const portionGrams = profile.portionGrams ?? grams;
    const base100gCal  = isPer100g ? profile.calories : (profile.calories / portionGrams) * 100;
    const base100gProt = isPer100g ? profile.protein  : (profile.protein  / portionGrams) * 100;
    const base100gCarb = isPer100g ? profile.carbs    : (profile.carbs    / portionGrams) * 100;
    const base100gFat  = isPer100g ? profile.fats     : (profile.fats     / portionGrams) * 100;
    const m = grams / 100;
    const result = {
      calories: base100gCal  * m,
      protein:  base100gProt * m,
      carbs:    base100gCarb * m,
      fats:     base100gFat  * m,
    };

    const resPath: ResolutionPath = ontologyResult.resolutionPath === 'concept_preparation'
      ? 'CONCEPT_PLUS_PREPARATION'
      : 'CONCEPT_MATCH';
    const src: NutritionSource = inferSource(ontologyResult.source);
    emitMetric(item.name, resPath, src, result, ontologyResult.guardrailWarnings, {
      foodConcept: ontologyResult.conceptId,
      preparation: ontologyResult.preparationId ?? undefined,
    });
    return result;
  }

  // ── Path 2: Dictionary per-100g ───────────────────────────
  if (food?.nutrition_per_100g) {
    const m = grams / 100;
    const result = {
      calories: food.nutrition_per_100g.calories * m,
      protein:  food.nutrition_per_100g.protein  * m,
      carbs:    food.nutrition_per_100g.carbs    * m,
      fats:     food.nutrition_per_100g.fats     * m,
    };
    emitMetric(item.name, 'EXACT_MATCH', 'COMPUTED', result, [], { foodConcept: food.id });
    return result;
  }

  // ── Path 3: Dictionary portion-based ──────────────────────
  if (food) {
    const multiplier = item.qty;
    const result = {
      calories: food.nutrition_per_portion.calories * multiplier,
      protein:  food.nutrition_per_portion.protein  * multiplier,
      carbs:    food.nutrition_per_portion.carbs    * multiplier,
      fats:     food.nutrition_per_portion.fats     * multiplier,
    };
    emitMetric(item.name, 'EXACT_MATCH', 'COMPUTED', result, [], { foodConcept: food.id });
    return result;
  }

  // ── Path 4: Pre-computed Gemini estimate ─────────────────
  const geminiEstimate = unknownEstimates?.get(item.name);
  if (geminiEstimate) {
    emitMetric(item.name, 'FALLBACK_CATEGORY', 'COMPUTED', geminiEstimate, []);
    return geminiEstimate;
  }

  // ── Path 5: Keyword-based heuristic fallback ──────────────
  const heuristic = estimateUnknownFood(item.name, grams);
  if (heuristic) {
    emitMetric(item.name, 'FALLBACK_CATEGORY', 'COMPUTED', heuristic, []);
    return {
      calories: heuristic.calories,
      protein:  heuristic.protein,
      carbs:    heuristic.carbs,
      fats:     heuristic.fats,
    };
  }

  // ── Path 6: Category fallback ─────────────────────────────
  const fallback = resolveCategoryFallback(null, grams, item.name);
  if (fallback) {
    const result = {
      calories: fallback.calories,
      protein:  fallback.protein,
      carbs:    fallback.carbs,
      fats:     fallback.fats,
    };
    emitMetric(item.name, 'FALLBACK_CATEGORY', 'FALLBACK', result, []);
    return result;
  }

  // ── Path 7: Absolute last resort — zeros, not invented values ─
  emitMetric(item.name, 'FAILED', 'FALLBACK', { calories: 0, protein: 0, carbs: 0, fats: 0 }, []);
  return { calories: 0, protein: 0, carbs: 0, fats: 0 };
}

// ── Helpers ───────────────────────────────────────────────────

function emitMetric(
  input: string,
  resolutionPath: ResolutionPath,
  source: NutritionSource,
  macros: { calories: number; protein: number; carbs: number; fats: number },
  guardrailWarnings: string[],
  extra?: { foodConcept?: string; preparation?: string },
): void {
  const confidence = pathToConfidence(resolutionPath);

  // Track unknown foods separately for discovery queue
  if (resolutionPath === 'FAILED' || resolutionPath === 'FALLBACK_CATEGORY') {
    trackUnknownFoodResolution(input, input.toLowerCase().trim());
  }

  // Non-blocking emit — never on hot return path
  queueMicrotask(() => {
    try {
      recordResolution({
        input,
        resolutionPath,
        foodConcept: extra?.foodConcept,
        preparation: extra?.preparation,
        confidence,
        finalMacros: {
          calories: macros.calories,
          protein:  macros.protein,
          fat:      macros.fats,
          carbs:    macros.carbs,
        },
        source,
        guardrailWarnings,
        timestamp: Date.now(),
      });
    } catch {
      // Observability never crashes main flow
    }
  });
}

function pathToConfidence(path: ResolutionPath): number {
  switch (path) {
    case 'EXACT_MATCH':              return 1.0;
    case 'CONCEPT_PLUS_PREPARATION': return 0.95;
    case 'CONCEPT_MATCH':            return 0.85;
    case 'FALLBACK_CATEGORY':        return 0.40;
    case 'FAILED':                   return 0.0;
  }
}

function inferSource(sourceStr: string): NutritionSource {
  const s = sourceStr.toUpperCase();
  if (s.includes('USDA'))    return 'USDA';
  if (s.includes('INTA'))    return 'INTA';
  if (s.includes('FALLBACK')) return 'FALLBACK';
  return 'COMPUTED';
}

export function aggregateNutrition(values: NutritionValues[]): NutritionValues {
  const total: NutritionValues = { calories: 0, protein: 0, carbs: 0, fats: 0 };

  for (const v of values) {
    total.calories += v.calories;
    total.protein += v.protein;
    total.carbs += v.carbs;
    total.fats += v.fats;
  }

  return total;
}

export function calculateRemaining(targets: NutritionValues, consumed: NutritionValues): NutritionValues {
  return {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fats: Math.max(0, targets.fats - consumed.fats),
  };
}
