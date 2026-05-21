import type { NutritionValues } from '../../types/index.js';

export interface Recommendation {
  text: string;
  suggested_foods: string[];
}

// Priority: 1) calories, 2) protein, 3) fats (excess), 4) carbs
export function generateRecommendation(
  remaining: NutritionValues,
  consumed?: NutritionValues,
  targets?: NutritionValues,
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
    };
  }

  // ── Large calorie deficit + high protein deficit ───────────
  if (calories > 500 && protein > 40) {
    if (hasFatExcess) {
      return {
        text: `Te faltan ${calories} cal y ${protein}g de proteína, pero ya te pasaste en grasas. Priorizá proteína magra: pechuga a la plancha, atún al natural, o claras con tostadas.`,
        suggested_foods: ['pechuga_pollo', 'atun_lata', 'tostadas'],
      };
    }
    return {
      text: `Te faltan ${calories} cal y ${protein}g de proteína. Recomendación: pollo con arroz y ensalada, o carne con puré.`,
      suggested_foods: ['pechuga_pollo', 'arroz', 'carne_asado'],
    };
  }

  // ── Large calorie deficit ──────────────────────────────────
  if (calories > 500) {
    if (carbs > 80) {
      return {
        text: `Te faltan ${calories} cal y ${carbs}g de carbos. Recomendación: fideos con tuco, arroz con pollo, o una tarta.`,
        suggested_foods: ['fideos_salsa', 'arroz', 'tarta_jamon_queso'],
      };
    }
    return {
      text: `Te faltan ${calories} calorías. Recomendación: un plato completo como guiso de lentejas o milanesa con ensalada.`,
      suggested_foods: ['guiso_lentejas', 'milanesa_carne'],
    };
  }

  // ── High protein deficit (but calories moderate) ───────────
  if (protein > 40) {
    if (hasFatExcess || fats <= 5) {
      return {
        text: `Te faltan ${protein}g de proteína y tenés poco margen de grasas. Recomendación: pechuga de pollo, atún al natural, o claras de huevo.`,
        suggested_foods: ['pechuga_pollo', 'atun_lata', 'huevo'],
      };
    }
    return {
      text: `Te faltan ${protein}g de proteína. Recomendación: carne magra, huevos, o yogur griego con frutos secos.`,
      suggested_foods: ['carne_asado', 'huevo', 'yogur_griego'],
    };
  }

  // ── Moderate protein deficit ───────────────────────────────
  if (protein > 20) {
    return {
      text: `Te faltan ${protein}g de proteína. Un snack proteico como yogur griego, queso o un puñado de almendras te acerca al objetivo.`,
      suggested_foods: ['yogur_griego', 'queso_port_salut', 'almendras'],
    };
  }

  // ── Carbs deficit ──────────────────────────────────────────
  if (carbs > 60 && calories > 200) {
    return {
      text: `Te faltan ${carbs}g de carbos y ${calories} cal. Podés sumar arroz, fideos o una fruta.`,
      suggested_foods: ['arroz', 'fideos', 'banana'],
    };
  }

  // ── Small calorie gap ──────────────────────────────────────
  if (calories > 200) {
    return {
      text: `Vas bien! Te faltan ${calories} cal. Podés cerrar con una fruta, un yogur o unas tostadas.`,
      suggested_foods: ['banana', 'yogur_griego', 'tostadas'],
    };
  }

  // ── On track ───────────────────────────────────────────────
  return {
    text: 'Estás muy cerca de tus objetivos. ¡Buen día nutricional!',
    suggested_foods: [],
  };
}
