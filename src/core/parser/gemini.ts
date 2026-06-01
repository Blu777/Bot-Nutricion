// ─── Gemini API Client ────────────────────────────────────────
// Calls Gemini to identify foods from text.
// Returns ONLY food mappings — NEVER nutrition values.

import { config } from '../../config/index.js';

export interface GeminiFoodMapping {
  original_text: string;
  suggested_food_id: string | null;
  suggested_name: string;
  quantity: number;
  confidence: number;
}

export interface GeminiResponse {
  foods: GeminiFoodMapping[];
  raw_response: string;
}

const SYSTEM_PROMPT = `Sos un asistente que identifica alimentos en texto en español argentino.
Tu UNICA tarea es mapear texto a nombres de alimentos de un diccionario.
NUNCA devuelvas valores nutricionales.

Dado un texto de comida, devolvé un JSON array con cada alimento identificado:
- "original_text": el fragmento original del texto
- "suggested_food_id": el ID del diccionario si lo reconocés, o null
- "suggested_name": nombre canónico del alimento (en español)
- "quantity": cantidad numérica (default 1)
- "confidence": 0-1 qué tan seguro estás del mapeo

Alimentos conocidos en el diccionario (ID → aliases):
milanesa_carne: milanesa, mila, milanga
milanesa_pollo: milanesa de pollo, suprema
milanesa_napolitana: napo, napolitana
pechuga_pollo: pechuga, pollo, pollo a la plancha
carne_asado: asado, carne, parrilla, costilla, vacio
carne_picada: carne picada, picada
hamburguesa: hamburguesa, burger
atun_lata: atun, lata de atun
merluza: merluza, pescado
huevo: huevo, huevos
yogur_griego: yogur griego, yogurt, yogur
queso_port_salut: queso, queso cremoso
leche: leche, vaso de leche
arroz: arroz, arroz blanco
fideos: fideos, pasta, spaghetti, tallarines
fideos_salsa: fideos con tuco, fideos con salsa, tuco
pure_papa: pure, puré de papa
papa: papa, papas, papas fritas
pan: pan, pan blanco, pan frances
tostadas: tostadas, tostada, pan tostado
avena: avena, copos de avena
empanada_carne: empanada, empanadas
empanada_jq: empanada de jamon y queso
tarta_jamon_queso: tarta, tarta de jamon y queso
guiso_lentejas: guiso, guiso de lentejas, lentejas
pizza_muzza: pizza, pizza muzza
ensalada_mixta: ensalada, ensalada mixta
batata: batata, boniato
banana: banana
manzana: manzana
almendras: almendras, puñado de almendras
mani: mani, maní
cafe_con_leche: cafe con leche, cafe
mate_cocido: mate cocido, mate
medialuna: medialuna, medialunas, facturas
galletitas_dulces: galletitas, galletas
galletitas_arroz: galletitas de arroz, tortitas de arroz
salsa_tomate: salsa, salsa de tomate

IMPORTANTE:
- Si no reconocés un alimento, sugerí el nombre más cercano con suggested_food_id: null
- Si el texto tiene múltiples alimentos, devolvé uno por cada uno
- Respondé SOLO con el JSON array, sin markdown ni explicación`;

export async function callGemini(normalizedText: string, unmatchedItems: string[]): Promise<GeminiResponse | null> {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    console.log('[gemini] No API key configured, skipping fallback');
    return null;
  }

  // Sanitization: prevent prompt injection by limiting length and stripping suspicious chars
  const safeText = normalizedText.slice(0, 150).replace(/[{}[\`\]]/g, '');
  const safeUnmatched = unmatchedItems.map(i => i.slice(0, 50).replace(/[{}[\`\]]/g, ''));

  const userPrompt = `Texto de comida: "${safeText}"
Alimentos no reconocidos por el parser local: [${safeUnmatched.map((i) => `"${i}"`).join(', ')}]
Identificá qué alimentos son y mapeá al diccionario.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${apiKey}`;
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        console.log(`[gemini] Fatal API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[gemini] Raw response:', rawText);

      const foods = parseGeminiResponse(rawText);
      return { foods, raw_response: rawText };
    } catch (error) {
      if (attempt === maxRetries) {
        console.log('[gemini] Request failed after retries:', error instanceof Error ? error.message : String(error));
        return null;
      }
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(`[gemini] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

function parseGeminiResponse(rawText: string): GeminiFoodMapping[] {
  try {
    // Strip markdown code fences if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: Record<string, unknown>) => ({
      original_text: String(item.original_text || ''),
      suggested_food_id: item.suggested_food_id ? String(item.suggested_food_id) : null,
      suggested_name: String(item.suggested_name || item.original_text || ''),
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
    }));
  } catch {
    console.log('[gemini] Failed to parse response JSON');
    return [];
  }
}
