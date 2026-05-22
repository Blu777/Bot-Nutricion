// ─── Food Ontology Graph ──────────────────────────────────────
// All base nutritional profiles are per 100g cooked weight unless noted.
// Sources: USDA FoodData Central (primary), INTA Argentina, FAO/INFOODS
//
// GUARDRAILS: If a computed value deviates >20% from baseline, a warning is emitted.
// NO free-text estimation. NO invented values.

import type { FoodConcept, PreparationMethod } from './types.js';

// ─── Preparation Methods ──────────────────────────────────────
// Defines how cooking transforms the base nutritional profile.

export const PREPARATION_METHODS: Record<string, PreparationMethod> = {
  hervido: {
    id: 'hervido',
    name: 'Hervido',
    aliases: ['hervido', 'hervida', 'duro', 'dura', 'cocido', 'cocida', 'al agua', 'en agua', 'pasado', 'pasada'],
    note: 'Hervido no altera macros significativamente respecto al cocido base',
  },
  frito: {
    id: 'frito',
    name: 'Frito',
    aliases: ['frito', 'frita', 'fritos', 'fritas', 'a la sartén', 'a la sarten'],
    calorieOffset: 40,
    fatMultiplier: 1.5,
    note: 'Fritura agrega ~40 cal y 50% más grasa por absorción de aceite',
  },
  horno: {
    id: 'horno',
    name: 'Al horno',
    aliases: ['al horno', 'horno', 'horneado', 'horneada', 'a la plancha', 'grillado', 'grillada', 'asado', 'asada'],
    calorieMultiplier: 0.95,
    fatMultiplier: 0.9,
    note: 'Horno/plancha reduce levemente calorías por deshidratación',
  },
  crudo: {
    id: 'crudo',
    name: 'Crudo',
    aliases: ['crudo', 'cruda', 'raw', 'sin cocinar', 'sin cocer'],
    note: 'Valores crudos — diferente peso por agua',
  },
  empanado: {
    id: 'empanado',
    name: 'Empanado',
    aliases: ['empanado', 'empanada', 'rebozado', 'rebozada', 'apanado', 'apanada'],
    calorieOffset: 80,
    carbMultiplier: 2.5,
    fatMultiplier: 1.4,
    note: 'Empanado agrega ~80 cal por pan rallado y absorción de aceite',
  },
  revuelto: {
    id: 'revuelto',
    name: 'Revuelto',
    aliases: ['revuelto', 'revuelta', 'scrambled'],
    calorieOffset: 15,
    fatMultiplier: 1.2,
    note: 'Revuelto suele incluir manteca/aceite (+15 cal aprox)',
  },
};

// ─── Food Concepts ────────────────────────────────────────────
// Each concept has:
//   baseProfile: valores por 100g cocido (USDA)
//   preparationProfiles: overrides específicos por método
//   guardrails: rangos válidos para validación

export const FOOD_CONCEPTS: Record<string, FoodConcept> = {

  // ══════════════════════════════════════════════════════════════
  // HUEVOS
  // USDA FoodData Central ID 748967 — Egg, whole, cooked, hard-boiled
  // Per 100g: 155 kcal, 13g protein, 1.1g carbs, 10.6g fat
  // Per large egg ~50g net: 78 kcal, 6.5g protein, 0.6g carbs, 5.3g fat
  // Standard Argentine egg portion: 60g (1 huevo mediano con cáscara ~60g, neto ~50g)
  // We use 60g as canonical portion for practical tracking
  // ══════════════════════════════════════════════════════════════
  huevo: {
    id: 'huevo',
    name: 'Huevo entero',
    aliases: [
      'huevo', 'huevos', 'egg', 'huevo entero',
      'huevo duro', 'huevo hervido', 'huevo cocido',
      'huevo frito', 'huevo revuelto', 'huevito', 'huevitos',
    ],
    category: 'huevos',
    baseProfile: {
      calories: 155,
      protein: 13,
      carbs: 1.1,
      fats: 10.6,
      per: '100g',
      portionGrams: 60,
      source: 'USDA FoodData Central #748967',
    },
    preparationProfiles: {
      frito: {
        calories: 196,
        protein: 13.6,
        carbs: 0.8,
        fats: 14.8,
        per: '100g',
        portionGrams: 60,
        source: 'USDA FoodData Central #173423 — Egg, fried',
      },
      hervido: {
        calories: 155,
        protein: 13,
        carbs: 1.1,
        fats: 10.6,
        per: '100g',
        portionGrams: 60,
        source: 'USDA FoodData Central #748967 — Egg, hard-boiled',
      },
      revuelto: {
        calories: 185,
        protein: 13.5,
        carbs: 1.6,
        fats: 14,
        per: '100g',
        portionGrams: 65,
        source: 'USDA FoodData Central #173424 — Egg, scrambled (with milk/butter)',
      },
    },
    guardrails: {
      minCaloriesPerPortion: 60,
      maxCaloriesPerPortion: 130,
      minProteinPerPortion: 5,
      maxProteinPerPortion: 10,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // ARROZ BLANCO COCIDO
  // USDA FoodData Central ID 168878 — Rice, white, long-grain, cooked
  // Per 100g cooked: 130 kcal, 2.7g protein, 28.2g carbs, 0.3g fat
  // ══════════════════════════════════════════════════════════════
  arroz_cocido: {
    id: 'arroz_cocido',
    name: 'Arroz blanco cocido',
    aliases: [
      'arroz', 'arroz blanco', 'arroz cocido', 'arrocito',
      'arroz hecho', 'arroz blanco hecho', 'arroz blanco cocido',
    ],
    category: 'carbohidratos',
    baseProfile: {
      calories: 130,
      protein: 2.7,
      carbs: 28.2,
      fats: 0.3,
      per: '100g',
      portionGrams: 200,
      source: 'USDA FoodData Central #168878',
    },
    guardrails: {
      minCaloriesPer100g: 100,
      maxCaloriesPer100g: 160,
      minProteinPer100g: 1.5,
      maxProteinPer100g: 4,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // PECHUGA DE POLLO
  // USDA FoodData Central ID 171477 — Chicken breast, roasted, without skin
  // Per 100g cooked: 165 kcal, 31g protein, 0g carbs, 3.6g fat
  // ══════════════════════════════════════════════════════════════
  pechuga_pollo: {
    id: 'pechuga_pollo',
    name: 'Pechuga de pollo',
    aliases: [
      'pechuga', 'pechuga de pollo', 'pecha', 'pollo', 'pollo grillado',
      'pollo a la plancha', 'pechuga grillada', 'pollo sin hueso',
      'pollo frito', 'pollo hervido', 'pechugas', 'pollito',
    ],
    category: 'carnes',
    baseProfile: {
      calories: 165,
      protein: 31,
      carbs: 0,
      fats: 3.6,
      per: '100g',
      portionGrams: 200,
      source: 'USDA FoodData Central #171477',
    },
    preparationProfiles: {
      frito: {
        calories: 187,
        protein: 28,
        carbs: 0,
        fats: 8,
        per: '100g',
        portionGrams: 200,
        source: 'USDA FoodData Central #171469 — Chicken breast, fried',
      },
    },
    guardrails: {
      minCaloriesPer100g: 130,
      maxCaloriesPer100g: 220,
      minProteinPer100g: 22,
      maxProteinPer100g: 38,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // CARNE VACUNA (MAGRA, COCIDA)
  // USDA FoodData Central ID 174032 — Beef, composite, cooked
  // Per 100g cooked: 215 kcal, 26g protein, 0g carbs, 12g fat
  // Range by cut: 170–280 kcal/100g
  // ══════════════════════════════════════════════════════════════
  carne_vacuna: {
    id: 'carne_vacuna',
    name: 'Carne vacuna',
    aliases: [
      'carne', 'carne vacuna', 'bife', 'asado', 'vacio', 'entrana',
      'costilla', 'tira de asado', 'bife de chorizo', 'churrasco',
      'carne roja', 'carne cocida',
    ],
    category: 'carnes',
    baseProfile: {
      calories: 215,
      protein: 26,
      carbs: 0,
      fats: 12,
      per: '100g',
      portionGrams: 200,
      source: 'USDA FoodData Central #174032',
    },
    guardrails: {
      minCaloriesPer100g: 160,
      maxCaloriesPer100g: 300,
      minProteinPer100g: 18,
      maxProteinPer100g: 32,
      warnIfDeviationPct: 25,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // FIDEOS / PASTA COCIDA
  // USDA FoodData Central ID 20121 — Pasta, cooked, enriched
  // Per 100g cooked: 131 kcal, 5g protein, 25.1g carbs, 1.1g fat
  // ══════════════════════════════════════════════════════════════
  pasta_cocida: {
    id: 'pasta_cocida',
    name: 'Pasta / Fideos cocidos',
    aliases: [
      'fideos', 'pasta', 'spaghetti', 'tallarines', 'espagueti', 'spagueti',
      'fideos cocidos', 'pasta cocida', 'tallarin',
    ],
    category: 'carbohidratos',
    baseProfile: {
      calories: 131,
      protein: 5,
      carbs: 25.1,
      fats: 1.1,
      per: '100g',
      portionGrams: 200,
      source: 'USDA FoodData Central #20121',
    },
    guardrails: {
      minCaloriesPer100g: 100,
      maxCaloriesPer100g: 170,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // PAPA HERVIDA
  // USDA FoodData Central ID 170093 — Potato, flesh, boiled
  // Per 100g: 87 kcal, 1.9g protein, 20.1g carbs, 0.1g fat
  // ══════════════════════════════════════════════════════════════
  papa_hervida: {
    id: 'papa_hervida',
    name: 'Papa hervida',
    aliases: ['papa', 'papas', 'papa hervida', 'papas hervidas', 'papa cocida'],
    category: 'carbohidratos',
    baseProfile: {
      calories: 87,
      protein: 1.9,
      carbs: 20.1,
      fats: 0.1,
      per: '100g',
      portionGrams: 150,
      source: 'USDA FoodData Central #170093',
    },
    preparationProfiles: {
      frito: {
        calories: 267,
        protein: 3,
        carbs: 27,
        fats: 15,
        per: '100g',
        portionGrams: 150,
        source: 'USDA FoodData Central #170691 — French fries',
      },
    },
    guardrails: {
      minCaloriesPer100g: 70,
      maxCaloriesPer100g: 110,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // ATÚN EN LATA AL NATURAL
  // USDA FoodData Central ID 175159 — Tuna, canned in water
  // Per 100g drained: 109 kcal, 25.5g protein, 0g carbs, 0.8g fat
  // ══════════════════════════════════════════════════════════════
  atun_lata: {
    id: 'atun_lata',
    name: 'Atún en lata (al natural)',
    aliases: ['atun', 'atún', 'lata de atun', 'atun en lata', 'atun al natural'],
    category: 'pescados',
    baseProfile: {
      calories: 109,
      protein: 25.5,
      carbs: 0,
      fats: 0.8,
      per: '100g',
      portionGrams: 80,
      source: 'USDA FoodData Central #175159',
    },
    guardrails: {
      minCaloriesPer100g: 80,
      maxCaloriesPer100g: 140,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // MILANESA DE CARNE (FRITA)
  // Composed: beef (empanada) + breadcrumb + frying oil
  // Base per 100g: ~213 kcal, 15g protein, 8g carbs, 13g fat
  // Source: INTA Argentina / FAO INFOODS AR Table
  // ══════════════════════════════════════════════════════════════
  milanesa_carne: {
    id: 'milanesa_carne',
    name: 'Milanesa de carne',
    aliases: [
      'milanesa', 'mila', 'milanga', 'milanesas', 'milas', 'milangas',
      'milanesita', 'milanesitas', 'milanesa de carne',
    ],
    category: 'carnes',
    baseProfile: {
      calories: 213,
      protein: 15,
      carbs: 8,
      fats: 13,
      per: '100g',
      portionGrams: 150,
      source: 'INTA Argentina / FAO INFOODS AR Table',
    },
    preparationProfiles: {
      horno: {
        calories: 175,
        protein: 22,
        carbs: 8,
        fats: 6,
        per: '100g',
        portionGrams: 150,
        source: 'INTA Argentina — Milanesa al horno',
      },
    },
    guardrails: {
      minCaloriesPer100g: 160,
      maxCaloriesPer100g: 280,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // PAN BLANCO
  // USDA FoodData Central ID 18069 — Bread, white, commercially prepared
  // Per 100g: 267 kcal, 9g protein, 49.3g carbs, 3.3g fat
  // ══════════════════════════════════════════════════════════════
  pan_blanco: {
    id: 'pan_blanco',
    name: 'Pan blanco',
    aliases: ['pan', 'pan blanco', 'rodaja de pan', 'pan francés', 'pan frances'],
    category: 'carbohidratos',
    baseProfile: {
      calories: 267,
      protein: 9,
      carbs: 49.3,
      fats: 3.3,
      per: '100g',
      portionGrams: 50,
      source: 'USDA FoodData Central #18069',
    },
    guardrails: {
      minCaloriesPer100g: 220,
      maxCaloriesPer100g: 320,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // LECHE ENTERA
  // USDA FoodData Central ID 746782 — Milk, whole, 3.25%
  // Per 100ml: 61 kcal, 3.2g protein, 4.8g carbs, 3.3g fat
  // ══════════════════════════════════════════════════════════════
  leche_entera: {
    id: 'leche_entera',
    name: 'Leche entera',
    aliases: ['leche', 'vaso de leche', 'leche entera'],
    category: 'lacteos',
    baseProfile: {
      calories: 61,
      protein: 3.2,
      carbs: 4.8,
      fats: 3.3,
      per: '100g',
      portionGrams: 200,
      source: 'USDA FoodData Central #746782',
    },
    guardrails: {
      minCaloriesPer100g: 45,
      maxCaloriesPer100g: 80,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // YOGUR GRIEGO
  // USDA FoodData Central ID 170903 — Yogurt, Greek, plain, nonfat
  // Full-fat Greek: ~97 kcal, 9g protein, 3.6g carbs, 5g fat per 100g
  // ══════════════════════════════════════════════════════════════
  yogur_griego: {
    id: 'yogur_griego',
    name: 'Yogur griego',
    aliases: ['yogur griego', 'yogurt griego', 'yogur', 'yogurt'],
    category: 'lacteos',
    baseProfile: {
      calories: 97,
      protein: 9,
      carbs: 3.6,
      fats: 5,
      per: '100g',
      portionGrams: 170,
      source: 'USDA FoodData Central #170903 (full-fat)',
    },
    guardrails: {
      minCaloriesPer100g: 55,
      maxCaloriesPer100g: 130,
      warnIfDeviationPct: 25,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // AVENA EN COPOS (CRUDA / DRY)
  // USDA FoodData Central ID 173904 — Oats, raw
  // Per 100g dry: 389 kcal, 16.9g protein, 66.3g carbs, 6.9g fat
  // ══════════════════════════════════════════════════════════════
  avena: {
    id: 'avena',
    name: 'Avena en copos',
    aliases: ['avena', 'avena arrollada', 'copos de avena'],
    category: 'carbohidratos',
    baseProfile: {
      calories: 389,
      protein: 16.9,
      carbs: 66.3,
      fats: 6.9,
      per: '100g',
      portionGrams: 40,
      source: 'USDA FoodData Central #173904',
    },
    guardrails: {
      minCaloriesPer100g: 340,
      maxCaloriesPer100g: 420,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // PALTA / AGUACATE
  // USDA FoodData Central ID 171706 — Avocados, raw, all commercial varieties
  // Per 100g: 160 kcal, 2g protein, 8.5g carbs, 14.7g fat
  // Standard portion: 100g (≈ half medium avocado)
  // ══════════════════════════════════════════════════════════════
  palta: {
    id: 'palta',
    name: 'Palta / Aguacate',
    aliases: ['palta', 'paltas', 'aguacate', 'aguacates', 'avocado'],
    category: 'verduras',
    baseProfile: {
      calories: 160,
      protein: 2,
      carbs: 8.5,
      fats: 14.7,
      per: '100g',
      portionGrams: 100,
      source: 'USDA FoodData Central #171706',
    },
    guardrails: {
      minCaloriesPer100g: 130,
      maxCaloriesPer100g: 200,
      minProteinPer100g: 1,
      maxProteinPer100g: 4,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // TOSTADA (PAN TOSTADO)
  // USDA FoodData Central ID 18069 — Bread, white, toasted
  // Toasting dehydrates: ~290 kcal, 9.5g protein, 54g carbs, 3.5g fat per 100g
  // Standard portion: 30g (≈ 2 thin slices)
  // ══════════════════════════════════════════════════════════════
  tostada: {
    id: 'tostada',
    name: 'Tostada',
    aliases: ['tostada', 'tostadas', 'pan tostado', 'pan tostadas'],
    category: 'carbohidratos',
    baseProfile: {
      calories: 290,
      protein: 9.5,
      carbs: 54,
      fats: 3.5,
      per: '100g',
      portionGrams: 30,
      source: 'USDA FoodData Central #18069 (toasted)',
    },
    guardrails: {
      minCaloriesPer100g: 240,
      maxCaloriesPer100g: 340,
      minProteinPer100g: 6,
      maxProteinPer100g: 14,
      warnIfDeviationPct: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════
  // MEDIALUNA DE MANTECA (ARGENTINE CROISSANT)
  // INTA Argentina / USDA FoodData Central #18253 — Croissant, butter
  // Per 100g: ~360 kcal, 6g protein, 44g carbs, 18g fat
  // Standard portion: 50g (1 medialuna)
  // ══════════════════════════════════════════════════════════════
  medialuna_de_manteca: {
    id: 'medialuna_de_manteca',
    name: 'Medialuna de manteca',
    aliases: ['medialuna de manteca', 'medialunas de manteca', 'croissant', 'croissants'],
    category: 'panaderia',
    baseProfile: {
      calories: 360,
      protein: 6,
      carbs: 44,
      fats: 18,
      per: '100g',
      portionGrams: 50,
      source: 'INTA Argentina / USDA FoodData Central #18253',
    },
    guardrails: {
      minCaloriesPer100g: 300,
      maxCaloriesPer100g: 420,
      minProteinPer100g: 4,
      maxProteinPer100g: 9,
      warnIfDeviationPct: 20,
    },
  },
};

// ─── Preparation-text → method ID map ─────────────────────────
// Used during text normalization to extract preparation method.
const _prepAliasMap: Map<string, string> = new Map();
for (const [id, method] of Object.entries(PREPARATION_METHODS)) {
  for (const alias of method.aliases) {
    _prepAliasMap.set(alias, id);
  }
}
export const PREP_ALIAS_MAP: ReadonlyMap<string, string> = _prepAliasMap;

// ─── Food-text → concept ID map ───────────────────────────────
const _conceptAliasMap: Map<string, string> = new Map();
for (const [id, concept] of Object.entries(FOOD_CONCEPTS)) {
  for (const alias of concept.aliases) {
    _conceptAliasMap.set(alias.toLowerCase().trim(), id);
  }
}
export const CONCEPT_ALIAS_MAP: ReadonlyMap<string, string> = _conceptAliasMap;
