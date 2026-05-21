import type { NutritionValues, UserGoal, ActivityLevel } from '../../types/index.js';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.0,
  light: 1.1,
  moderate: 1.2,
  active: 1.35,
  very_active: 1.5,
};

const BASE_CALORIES_PER_KG: Record<UserGoal, number> = {
  lose_fat: 24,
  maintain: 30,
  gain_muscle: 35,
};

const CALORIE_OFFSET: Record<UserGoal, number> = {
  lose_fat: -300,
  maintain: 0,
  gain_muscle: 300,
};

const PROTEIN_PER_KG: Record<UserGoal, number> = {
  lose_fat: 2.0,
  maintain: 1.6,
  gain_muscle: 2.2,
};

const FAT_CALORIE_PERCENT = 0.25;
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARBS = 4;
const CALORIES_PER_GRAM_FAT = 9;

export function calculateTargets(
  weightKg: number,
  goal: UserGoal,
  activityLevel: ActivityLevel
): NutritionValues {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  const baseCal = BASE_CALORIES_PER_KG[goal];
  const offset = CALORIE_OFFSET[goal];

  const tdee = weightKg * baseCal * multiplier;
  const targetCalories = Math.round(tdee + offset);

  const protein = Math.round(weightKg * PROTEIN_PER_KG[goal]);
  const fats = Math.round((targetCalories * FAT_CALORIE_PERCENT) / CALORIES_PER_GRAM_FAT);

  const proteinCalories = protein * CALORIES_PER_GRAM_PROTEIN;
  const fatCalories = fats * CALORIES_PER_GRAM_FAT;
  const carbs = Math.round((targetCalories - proteinCalories - fatCalories) / CALORIES_PER_GRAM_CARBS);

  return {
    calories: targetCalories,
    protein,
    carbs,
    fats,
  };
}
