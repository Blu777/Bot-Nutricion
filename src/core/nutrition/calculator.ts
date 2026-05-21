import type { ParsedItem, NutritionValues, FoodEntry } from '../../types/index.js';
import { config } from '../../config/index.js';

export function calculateMealNutrition(
  items: ParsedItem[],
  foodMap: Map<string, FoodEntry>
): NutritionValues {
  const total: NutritionValues = { calories: 0, protein: 0, carbs: 0, fats: 0 };

  for (const item of items) {
    const nutrition = calculateItemNutrition(item, foodMap);
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
  foodMap: Map<string, FoodEntry>
): NutritionValues {
  const food = foodMap.get(item.food_id);

  if (!food) {
    // Unknown food — use generic estimation
    const generic = config.defaults.genericFood;
    return {
      calories: generic.calories * item.qty,
      protein: generic.protein * item.qty,
      carbs: generic.carbs * item.qty,
      fats: generic.fats * item.qty,
    };
  }

  let multiplier: number;

  if (item.grams && food.nutrition_per_100g) {
    // User specified grams — calculate from per-100g values
    multiplier = item.grams / 100;
    return {
      calories: food.nutrition_per_100g.calories * multiplier,
      protein: food.nutrition_per_100g.protein * multiplier,
      carbs: food.nutrition_per_100g.carbs * multiplier,
      fats: food.nutrition_per_100g.fats * multiplier,
    };
  }

  // Default: use portion-based calculation
  multiplier = item.qty;
  return {
    calories: food.nutrition_per_portion.calories * multiplier,
    protein: food.nutrition_per_portion.protein * multiplier,
    carbs: food.nutrition_per_portion.carbs * multiplier,
    fats: food.nutrition_per_portion.fats * multiplier,
  };
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
