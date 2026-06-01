import type { ParsedItem } from '../../types/index.js';
import { config } from '../../config/index.js';

export interface AuditResult {
  status: 'aprobado' | 'incompleto' | 'fuera_de_plan' | 'pendiente';
  missing_components: string[];
  penalties: string[];
}

const SYSTEM_PROMPT = `Sos el auditor nutricional estricto del bot, basado en las reglas de la Lic. Daniela Romina Abuin. 
Tu única tarea es evaluar una comida y devolver SOLO un JSON con el resultado. No escribas texto markdown ni explicaciones, solo el JSON puro.

REGLAS ESTRICTAS DE AUDITORÍA:
1. Desayunos y Meriendas:
   - Debe haber AL MENOS 1 alimento de cada grupo esencial: Proteína (ej. huevo, queso, yogur), Carbohidrato (ej. pan, avena, fruta) y Grasa/Fibra.
   - Si falta alguno, el status es "incompleto" y se debe listar en "missing_components".
2. Almuerzos y Cenas:
   - Es OBLIGATORIO un mínimo de 3 verduras o una porción grande de ensalada/verduras. Si hay menos de 3 o no hay verduras, el status es "incompleto" y "Verduras (Mínimo 3)" va a missing_components.
   - Debe haber Proteína.
3. Contexto de Entrenamiento:
   - "Día con entrenamiento": Se permiten y exigen Carbohidratos complejos (arroz, fideos, papa, batata). Si faltan en una comida principal, agregarlos a missing_components.
   - "Día sin entrenamiento": Los carbohidratos deben minimizarse. Si hay exceso de carbohidratos, se puede marcar como "fuera_de_plan" o añadir a penalties.
4. Alimentos Fuera de Plan (Trampa):
   - Alimentos ultraprocesados, alcohol, pizza, hamburguesa, helado, galletitas dulces, facturas, etc., automáticamente cambian el status a "fuera_de_plan".
   - El alimento infractor va al array "penalties".

FORMATO DE SALIDA (JSON EXACTO):
{
  "status": "aprobado" | "incompleto" | "fuera_de_plan",
  "missing_components": ["string"],
  "penalties": ["string"]
}`;

export async function auditMeal(rawText: string, items: ParsedItem[], isTrainingDay: boolean): Promise<AuditResult> {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    return { status: 'pendiente', missing_components: [], penalties: [] };
  }

  // Sanitization
  const safeText = rawText.slice(0, 150).replace(/[{}[\`\]]/g, '');
  const parsedItemsText = items.map(i => `${i.qty} ${i.unit} de ${i.name}`).join(', ');

  const userPrompt = `Contexto: ${isTrainingDay ? 'Día con entrenamiento' : 'Día sin entrenamiento'}
Texto del usuario: "${safeText}"
Alimentos parseados: [${parsedItemsText}]
Evaluá la comida según las reglas clínicas y devolvé el JSON.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${apiKey}`;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\\n\\n' + userPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`API error: ${response.status}`);
        }
        return { status: 'pendiente', missing_components: [], penalties: [] };
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const rawTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse JSON
      let cleaned = rawTextResponse.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleaned) as AuditResult;
      
      // Validate structure
      if (!['aprobado', 'incompleto', 'fuera_de_plan'].includes(parsed.status)) {
        throw new Error('Invalid status');
      }

      return {
        status: parsed.status,
        missing_components: Array.isArray(parsed.missing_components) ? parsed.missing_components : [],
        penalties: Array.isArray(parsed.penalties) ? parsed.penalties : []
      };
      
    } catch (error) {
      if (attempt === maxRetries) {
        console.log('[auditor] LLM Audit failed:', error instanceof Error ? error.message : String(error));
        return { status: 'pendiente', missing_components: [], penalties: [] };
      }
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { status: 'pendiente', missing_components: [], penalties: [] };
}
