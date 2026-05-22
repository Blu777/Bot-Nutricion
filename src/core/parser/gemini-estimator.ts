// ─── Gemini Nutrition Estimator ───────────────────────────────
// Calls Gemini to estimate macros for unknown foods.
// ONLY used when a food is unmatched by both dictionary and ontology.
// Returns conservative estimates with explicit uncertainty flags.

import { config } from '../../config/index.js';
import type { NutritionValues } from '../../types/index.js';

export interface GeminiNutritionEstimate {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  grams: number;
  confidence: number;
  note: string;
}

const SYSTEM_PROMPT = `Sos un nutricionista argentino experto. Tu UNICA tarea es estimar valores nutricionales aproximados para alimentos desconocidos en español rioplatense.

Dado un alimento y su peso aproximado en gramos, devolvé SOLO un JSON con ESTOS CAMPOS EXACTOS (sin markdown, sin explicaciones):
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "confidence": 0-1,
  "note": "string breve justificando la fuente o metodología"
}

REGLAS:
- Usá fuentes USDA o INTA Argentina cuando sea posible.
- Si no sabés con certeza, devolvé valores conservadores (ligeramente por debajo de la media).
- NUNCA inventes valores absurdos. Una porción común NO tiene 100g de proteína.
- El peso indicado es el peso REAL del alimento (no por 100g). Calculá los macros para ese peso.`;

export async function estimateNutritionWithGemini(
  foodName: string,
  grams: number,
): Promise<GeminiNutritionEstimate | null> {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    return null;
  }

  const userPrompt = `Alimento: "${foodName}"
Peso aproximado: ${grams}g
Estimá los macros para ese peso exacto.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[gemini-estimator] API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseEstimate(rawText, foodName, grams);
  } catch (error) {
    console.log('[gemini-estimator] Request failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function parseEstimate(
  rawText: string,
  foodName: string,
  grams: number,
): GeminiNutritionEstimate | null {
  try {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const calories = typeof parsed.calories === 'number' ? parsed.calories : 0;
    const protein = typeof parsed.protein === 'number' ? parsed.protein : 0;
    const carbs = typeof parsed.carbs === 'number' ? parsed.carbs : 0;
    const fats = typeof parsed.fats === 'number' ? parsed.fats : 0;
    const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
    const note = typeof parsed.note === 'string' ? parsed.note : 'Estimado por Gemini';

    // Sanity guardrails — reject absurd values
    const maxCalories = grams * 9;
    if (calories > maxCalories || calories < 0) {
      console.log(`[gemini-estimator] Rejected absurd calories: ${calories} for ${grams}g`);
      return null;
    }
    if (protein > grams || carbs > grams || fats > grams) {
      console.log(`[gemini-estimator] Rejected absurd macros: P=${protein} C=${carbs} F=${fats} for ${grams}g`);
      return null;
    }

    // Hard physical-validation guardrail (CR-3)
    if (!isPhysicallyPossible({ calories, protein, carbs, fats }, grams)) {
      console.log(`[gemini-estimator] Rejected physically impossible macros: P=${protein} C=${carbs} F=${fats} cal=${calories} for ${grams}g`);
      return null;
    }

    return {
      food_name: foodName,
      calories,
      protein,
      carbs,
      fats,
      grams,
      confidence,
      note,
    };
  } catch {
    console.log('[gemini-estimator] Failed to parse JSON');
    return null;
  }
}

function isPhysicallyPossible(
  macros: { calories: number; protein: number; carbs: number; fats: number },
  grams: number,
): boolean {
  // 1. Macronutrient mass cannot exceed food mass (allow 10% for water/fiber/ash)
  const totalMacros = macros.protein + macros.carbs + macros.fats;
  if (totalMacros > grams * 1.1) {
    return false;
  }

  // 2. Caloric equation must hold within tolerance (allow ±2 cal/g for rounding/fiber)
  const expectedCalories = macros.protein * 4 + macros.carbs * 4 + macros.fats * 9;
  const calDeviation = Math.abs(macros.calories - expectedCalories);
  if (calDeviation > grams * 2) {
    return false;
  }

  return true;
}
