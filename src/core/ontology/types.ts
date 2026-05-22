// ─── Food Ontology Types ──────────────────────────────────────
// Defines the semantic graph model for deterministic nutrition resolution.
// Source of truth priority: USDA FoodData Central > INTA Argentina > FAO/INFOODS

export interface NutritionalProfile {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  per: 'portion' | '100g';
  portionGrams?: number;
  source: string;
}

export interface PreparationMethod {
  id: string;
  name: string;
  aliases: string[];
  calorieMultiplier?: number;
  calorieOffset?: number;
  proteinMultiplier?: number;
  fatMultiplier?: number;
  carbMultiplier?: number;
  note?: string;
}

export interface FoodConcept {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  baseProfile: NutritionalProfile;
  preparationProfiles?: Partial<Record<string, NutritionalProfile>>;
  guardrails: NutritionalGuardrail;
}

export interface NutritionalGuardrail {
  maxCaloriesPer100g?: number;
  minCaloriesPer100g?: number;
  maxProteinPer100g?: number;
  minProteinPer100g?: number;
  maxCaloriesPerPortion?: number;
  minCaloriesPerPortion?: number;
  maxProteinPerPortion?: number;
  minProteinPerPortion?: number;
  warnIfDeviationPct?: number;
}

export interface OntologyResolutionResult {
  conceptId: string;
  conceptName: string;
  preparationId: string | null;
  profile: NutritionalProfile;
  resolutionPath: 'exact_item' | 'concept_preparation' | 'concept_base' | 'category_fallback';
  guardrailWarnings: string[];
  source: string;
}

export interface OntologyLookupInput {
  foodText: string;
  preparationText?: string;
  grams?: number;
  qty: number;
  unit: 'portion' | 'g' | 'ml' | 'kg';
}
