// ─── Nutritional Guardrails ────────────────────────────────────
// Validates computed nutrition values against known-safe bounds.
// Any deviation >warnIfDeviationPct% from the concept baseline emits a warning.
// Values outside hard bounds (min/max) emit an error-level warning.

import type { NutritionalGuardrail, NutritionalProfile } from './types.js';

export interface GuardrailResult {
  passed: boolean;
  warnings: string[];
}

export function validateAgainstGuardrails(
  conceptId: string,
  profile: NutritionalProfile,
  computedCalories: number,
  computedProtein: number,
  grams: number,
  guardrail: NutritionalGuardrail,
): GuardrailResult {
  const warnings: string[] = [];

  const isPer100g = profile.per === '100g';
  const portionGrams = profile.portionGrams ?? grams;

  // Normalize to per-100g for comparison
  const baseCalPer100 = isPer100g
    ? profile.calories
    : (profile.calories / portionGrams) * 100;
  const baseProtPer100 = isPer100g
    ? profile.protein
    : (profile.protein / portionGrams) * 100;

  const computedCalPer100 = (computedCalories / grams) * 100;
  const computedProtPer100 = (computedProtein / grams) * 100;

  const warnPct = guardrail.warnIfDeviationPct ?? 20;

  // ── Hard bound checks (per 100g) ──────────────────────────
  if (guardrail.maxCaloriesPer100g !== undefined && computedCalPer100 > guardrail.maxCaloriesPer100g) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Calorías/100g calculadas (${computedCalPer100.toFixed(1)}) superan el máximo permitido (${guardrail.maxCaloriesPer100g})`,
    );
  }
  if (guardrail.minCaloriesPer100g !== undefined && computedCalPer100 < guardrail.minCaloriesPer100g) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Calorías/100g calculadas (${computedCalPer100.toFixed(1)}) están por debajo del mínimo (${guardrail.minCaloriesPer100g})`,
    );
  }
  if (guardrail.maxProteinPer100g !== undefined && computedProtPer100 > guardrail.maxProteinPer100g) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Proteína/100g calculada (${computedProtPer100.toFixed(1)}) supera el máximo (${guardrail.maxProteinPer100g})`,
    );
  }
  if (guardrail.minProteinPer100g !== undefined && computedProtPer100 < guardrail.minProteinPer100g) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Proteína/100g calculada (${computedProtPer100.toFixed(1)}) está por debajo del mínimo (${guardrail.minProteinPer100g})`,
    );
  }

  // ── Hard bound checks (per portion) ──────────────────────
  if (guardrail.maxCaloriesPerPortion !== undefined && computedCalories > guardrail.maxCaloriesPerPortion) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Calorías por porción (${computedCalories.toFixed(1)}) superan el máximo (${guardrail.maxCaloriesPerPortion})`,
    );
  }
  if (guardrail.minCaloriesPerPortion !== undefined && computedCalories < guardrail.minCaloriesPerPortion) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Calorías por porción (${computedCalories.toFixed(1)}) están por debajo del mínimo (${guardrail.minCaloriesPerPortion})`,
    );
  }
  if (guardrail.maxProteinPerPortion !== undefined && computedProtein > guardrail.maxProteinPerPortion) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Proteína por porción (${computedProtein.toFixed(1)}) supera el máximo (${guardrail.maxProteinPerPortion})`,
    );
  }
  if (guardrail.minProteinPerPortion !== undefined && computedProtein < guardrail.minProteinPerPortion) {
    warnings.push(
      `[GUARDRAIL][${conceptId}] Proteína por porción (${computedProtein.toFixed(1)}) está por debajo del mínimo (${guardrail.minProteinPerPortion})`,
    );
  }

  // ── Deviation from baseline ────────────────────────────────
  if (baseCalPer100 > 0) {
    const calDeviation = Math.abs(computedCalPer100 - baseCalPer100) / baseCalPer100;
    if (calDeviation > warnPct / 100) {
      warnings.push(
        `[GUARDRAIL][${conceptId}] Calorías/100g se desvían ${(calDeviation * 100).toFixed(1)}% del baseline (${baseCalPer100} cal/100g)`,
      );
    }
  }
  if (baseProtPer100 > 0) {
    const protDeviation = Math.abs(computedProtPer100 - baseProtPer100) / baseProtPer100;
    if (protDeviation > warnPct / 100) {
      warnings.push(
        `[GUARDRAIL][${conceptId}] Proteína/100g se desvía ${(protDeviation * 100).toFixed(1)}% del baseline (${baseProtPer100}g/100g)`,
      );
    }
  }

  return {
    passed: warnings.length === 0,
    warnings,
  };
}
