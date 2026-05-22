import type { NutritionValues } from '../../types/index.js';

export interface MealVariation {
  text: string;
  foods: string[];
  estimated_macros: NutritionValues;
}

export interface Recommendation {
  text: string;
  suggested_foods: string[];
  variations: MealVariation[];
}

interface MealTemplate {
  name: string;
  foods: string[];
  macros: NutritionValues;
  tags: Array<'high_protein' | 'low_fat' | 'balanced' | 'quick' | 'vegetarian'>;
}

// ═══════════════════════════════════════════════════════════════
// Meal Template Database — real Argentine meals with honest macros
// ═══════════════════════════════════════════════════════════════
const MEAL_TEMPLATES: MealTemplate[] = [
  // Proteína magra + carbohidratos + verduras
  { name: 'Pechuga a la plancha con arroz y ensalada', foods: ['pechuga_pollo', 'arroz', 'ensalada_mixta'], macros: { calories: 550, protein: 51, carbs: 66, fats: 6 }, tags: ['high_protein', 'balanced'] },
  { name: 'Atún al natural con papa y ensalada', foods: ['atun_lata', 'papa', 'ensalada_mixta'], macros: { calories: 400, protein: 44, carbs: 36, fats: 4 }, tags: ['high_protein', 'low_fat'] },
  { name: 'Pollo al horno con arroz y ensalada', foods: ['pollo_horno', 'arroz', 'ensalada_mixta'], macros: { calories: 580, protein: 41, carbs: 58, fats: 18 }, tags: ['balanced'] },
  { name: 'Carne asado con puré de papa y verduras', foods: ['carne_asado', 'pure_papa', 'ensalada_mixta'], macros: { calories: 630, protein: 43, carbs: 41, fats: 30 }, tags: ['balanced'] },
  { name: 'Milanesa al horno con puré y verduras', foods: ['milanesa_horno', 'pure_papa', 'ensalada_mixta'], macros: { calories: 480, protein: 29, carbs: 45, fats: 14 }, tags: ['balanced'] },
  { name: 'Pechuga con fideos y salsa de tomate', foods: ['pechuga_pollo', 'fideos', 'salsa_tomate'], macros: { calories: 520, protein: 46, carbs: 55, fats: 8 }, tags: ['high_protein', 'balanced'] },
  { name: 'Carne picada con arroz y verduras', foods: ['carne_picada', 'arroz', 'ensalada_mixta'], macros: { calories: 500, protein: 35, carbs: 58, fats: 12 }, tags: ['balanced'] },
  { name: 'Merluza al horno con arroz y verduras', foods: ['merluza', 'arroz', 'ensalada_mixta'], macros: { calories: 470, protein: 39, carbs: 66, fats: 4 }, tags: ['high_protein', 'low_fat'] },

  // Desayuno / merienda completos
  { name: 'Tostadas con palta y huevo duro', foods: ['tostadas', 'palta', 'huevo'], macros: { calories: 380, protein: 17, carbs: 28, fats: 22 }, tags: ['balanced'] },
  { name: 'Yogur griego con banana y almendras', foods: ['yogur_griego', 'banana', 'almendras'], macros: { calories: 420, protein: 22, carbs: 38, fats: 20 }, tags: ['balanced', 'quick'] },
  { name: 'Avena con leche y fruta', foods: ['avena', 'leche', 'banana'], macros: { calories: 400, protein: 12, carbs: 65, fats: 8 }, tags: ['quick'] },
  { name: 'Café con leche y medialuna de manteca', foods: ['cafe_con_leche', 'medialuna'], macros: { calories: 260, protein: 7, carbs: 29, fats: 13 }, tags: ['quick'] },
  { name: 'Sándwich de jamón y queso con ensalada', foods: ['sandwich_jq', 'ensalada_mixta'], macros: { calories: 350, protein: 18, carbs: 30, fats: 15 }, tags: ['balanced', 'quick'] },

  // Legumbres y pastas
  { name: 'Guiso de lentejas con verduras', foods: ['guiso_lentejas', 'ensalada_mixta'], macros: { calories: 430, protein: 24, carbs: 58, fats: 9 }, tags: ['balanced', 'vegetarian'] },
  { name: 'Fideos con salsa (tuco) y queso rallado', foods: ['fideos_salsa', 'queso_rallado'], macros: { calories: 420, protein: 19, carbs: 62, fats: 12 }, tags: ['balanced'] },
  { name: 'Ñoquis con salsa y queso', foods: ['noquis', 'salsa_tomate', 'queso_rallado'], macros: { calories: 480, protein: 14, carbs: 67, fats: 16 }, tags: ['balanced'] },
  { name: 'Ravioles con salsa y queso', foods: ['ravioles', 'salsa_tomate', 'queso_rallado'], macros: { calories: 500, protein: 20, carbs: 57, fats: 20 }, tags: ['balanced'] },
  { name: 'Lentejas cocidas con arroz y verduras', foods: ['lentejas', 'arroz', 'ensalada_mixta'], macros: { calories: 490, protein: 26, carbs: 74, fats: 6 }, tags: ['balanced', 'vegetarian'] },

  // Snacks / cierres livianos
  { name: 'Fruta con yogur y puñado de almendras', foods: ['banana', 'yogur_griego', 'almendras'], macros: { calories: 380, protein: 15, carbs: 35, fats: 18 }, tags: ['quick'] },
  { name: 'Queso port salut con galletitas de arroz', foods: ['queso_port_salut', 'galletitas_arroz'], macros: { calories: 200, protein: 9, carbs: 22, fats: 9 }, tags: ['quick'] },
  { name: 'Palta con tostadas y queso rallado', foods: ['palta', 'tostadas', 'queso_rallado'], macros: { calories: 350, protein: 14, carbs: 28, fats: 20 }, tags: ['balanced', 'quick'] },
  { name: 'Huevos revueltos con tostadas', foods: ['huevo', 'tostadas'], macros: { calories: 310, protein: 20, carbs: 22, fats: 16 }, tags: ['high_protein', 'quick'] },

  // Opciones bajas en grasa (para exceso de grasa)
  { name: 'Claras de huevo con tostadas y palta', foods: ['huevo', 'tostadas', 'palta'], macros: { calories: 320, protein: 16, carbs: 26, fats: 16 }, tags: ['low_fat', 'balanced'] },
  { name: 'Pechuga a la plancha con verduras mixtas', foods: ['pechuga_pollo', 'ensalada_mixta'], macros: { calories: 290, protein: 48, carbs: 9, fats: 6 }, tags: ['high_protein', 'low_fat'] },
  { name: 'Atún con ensalada de tomate y lechuga', foods: ['atun_lata', 'tomate', 'lechuga'], macros: { calories: 280, protein: 30, carbs: 10, fats: 3 }, tags: ['high_protein', 'low_fat'] },
  { name: 'Merluza con puré de papa (sin manteca)', foods: ['merluza', 'papa'], macros: { calories: 310, protein: 39, carbs: 30, fats: 4 }, tags: ['high_protein', 'low_fat'] },
];

// ═══════════════════════════════════════════════════════════════
// Scoring
// ═══════════════════════════════════════════════════════════════

function scoreTemplate(template: MealTemplate, remaining: NutritionValues, hasFatExcess: boolean): number {
  const { calories: remCal, protein: remProt, carbs: remCarb, fats: remFat } = remaining;
  const { calories: tCal, protein: tProt, carbs: tCarb, fats: tFat } = template.macros;

  // Hard filters
  if (tCal > remCal * 1.5) return -Infinity; // way too many calories
  if (hasFatExcess && tFat > remFat) return -Infinity; // can't afford more fat

  let score = 0;

  // Protein fit: reward getting close to remaining protein, penalize exceeding it slightly
  const protDiff = Math.abs(tProt - remProt);
  score += 50 - protDiff;

  // Calorie fit: reward meals that fill the gap well
  const calDiff = Math.abs(tCal - remCal);
  score += 40 - calDiff * 0.1;

  // Carb fit: moderate weight
  const carbDiff = Math.abs(tCarb - remCarb);
  score += 15 - carbDiff * 0.15;

  // Fat fit: only if not in excess
  if (!hasFatExcess) {
    const fatDiff = Math.abs(tFat - remFat);
    score += 10 - fatDiff * 0.2;
  } else {
    // Strong bonus for low-fat meals when in excess
    score += (30 - tFat) * 0.5;
  }

  // Bonus for balanced tag when multiple deficits exist
  if (template.tags.includes('balanced') && remProt > 20 && remCarb > 30) {
    score += 15;
  }

  // Bonus for high protein when protein deficit is large
  if (template.tags.includes('high_protein') && remProt > 30) {
    score += 10;
  }

  return score;
}

function dedupeByName(variations: MealVariation[]): MealVariation[] {
  const seen = new Set<string>();
  return variations.filter((v) => {
    if (seen.has(v.text)) return false;
    seen.add(v.text);
    return true;
  });
}

// Priority: 1) calories, 2) protein, 3) fats (excess), 4) carbs
export function generateRecommendation(
  remaining: NutritionValues,
  consumed?: NutritionValues,
  targets?: NutritionValues,
  consumedFoodIds: string[] = [],
): Recommendation {
  const { protein, calories, fats, carbs } = remaining;

  // Detect fat excess (consumed > target)
  const fatExcess = consumed && targets
    ? Math.max(0, consumed.fats - targets.fats)
    : 0;
  const hasFatExcess = fatExcess > 10;

  // ── Exceeded calories ──────────────────────────────────────
  if (calories <= 0) {
    return {
      text: 'Ya llegaste a tu objetivo calórico de hoy. Si tenés hambre, optá por algo liviano como verduras, una infusión o un caldo.',
      suggested_foods: [],
      variations: [],
    };
  }

  // Score all templates
  const scored = MEAL_TEMPLATES.map((template) => ({
    template,
    score: scoreTemplate(template, remaining, hasFatExcess),
  })).filter((s) => s.score > -Infinity);

  // Sort descending
  scored.sort((a, b) => b.score - a.score);

  // Filter out meals containing already-consumed foods (when possible)
  const hasConsumed = (foods: string[]) =>
    consumedFoodIds.length > 0 && foods.some((f) => consumedFoodIds.includes(f));

  let candidates = scored.filter((s) => !hasConsumed(s.template.foods));
  // If filtering leaves us with too few, fall back to full list
  if (candidates.length < 3) {
    candidates = scored;
  }

  // Build top 4 variations
  const topTemplates = candidates.slice(0, 4);
  const variations: MealVariation[] = topTemplates.map((s) => ({
    text: s.template.name,
    foods: s.template.foods,
    estimated_macros: s.template.macros,
  }));

  const deduped = dedupeByName(variations).slice(0, 4);

  // Top pick = first variation
  const top = deduped[0];

  // Build dynamic text based on deficits
  let text: string;
  if (calories > 500 && protein > 40) {
    if (hasFatExcess) {
      text = `Te faltan ${calories} cal y ${protein}g de proteína, pero ya te pasaste en grasas. Opciones magras: ${top?.text ?? 'consultá con un nutricionista'}.`;
    } else {
      text = `Te faltan ${calories} cal y ${protein}g de proteína. Opción principal: ${top?.text ?? ''}.`;
    }
  } else if (calories > 500) {
    if (carbs > 80) {
      text = `Te faltan ${calories} cal y ${carbs}g de carbos. Opción principal: ${top?.text ?? ''}.`;
    } else {
      text = `Te faltan ${calories} calorías. Opción principal: ${top?.text ?? ''}.`;
    }
  } else if (protein > 40 && calories > 200) {
    if (hasFatExcess || fats <= 5) {
      text = `Te faltan ${protein}g de proteína con poco margen de grasas. Opción principal: ${top?.text ?? ''}.`;
    } else {
      text = `Te faltan ${protein}g de proteína. Opción principal: ${top?.text ?? ''}.`;
    }
  } else if (protein > 20) {
    text = `Te faltan ${protein}g de proteína. ${top?.text ?? ''} es una buena opción proteica.`;
  } else if (carbs > 60 && calories > 200) {
    text = `Te faltan ${carbs}g de carbos y ${calories} cal. Opción principal: ${top?.text ?? ''}.`;
  } else if (calories > 200) {
    text = `Vas bien! Te faltan ${calories} cal. Podés cerrar con: ${top?.text ?? ''}.`;
  } else {
    text = 'Estás muy cerca de tus objetivos. ¡Buen día nutricional!';
  }

  return {
    text,
    suggested_foods: top?.foods ?? [],
    variations: deduped,
  };
}
