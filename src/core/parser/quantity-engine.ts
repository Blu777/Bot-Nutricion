// ─── Quantity Engine ──────────────────────────────────────────
// Resolves real-world quantity expressions to numeric values.
// Handles: fractions, volume units, vague quantities, "y medio".

export interface QuantityResolution {
  quantity: number;
  unit: 'g' | 'ml' | 'kg' | 'portion';
  grams?: number;
  isAssumed: boolean;
  warning?: string;
}

export interface ResolvedSegment extends QuantityResolution {
  remainingText: string;
}

// Word numbers and spoken fractions
const WORD_NUMBERS: Record<string, number> = {
  'un': 1, 'una': 1, 'uno': 1, 'unos': 1, 'unas': 1,
  'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
  'medio': 0.5, 'media': 0.5,
  'cuarto': 0.25, 'un cuarto': 0.25,
  'tres cuartos': 0.75,
};

// Volume units → mass/volume equivalents
const VOLUME_UNITS: Record<string, { unit: 'g' | 'ml'; grams: number }> = {
  'cda': { unit: 'g', grams: 15 },
  'cucharada': { unit: 'g', grams: 15 },
  'cdita': { unit: 'g', grams: 5 },
  'cucharadita': { unit: 'g', grams: 5 },
  'chorrito': { unit: 'g', grams: 10 },
  'chorro': { unit: 'g', grams: 20 },
  'taza': { unit: 'g', grams: 200 },
  'vaso': { unit: 'ml', grams: 250 },
  'pizca': { unit: 'g', grams: 1 },
};

// Vague quantity scaling factors
const VAGUE_SCALE: Record<string, { factor: number; warning: string }> = {
  'poco': { factor: 0.25, warning: 'La cantidad "poco" es ambigua. Asumí 1/4 de porción.' },
  'poquito': { factor: 0.15, warning: 'La cantidad "poquito" es ambigua. Asumí una pequeña porción.' },
  'algo': { factor: 0.25, warning: 'La cantidad "algo" es ambigua. Asumí 1/4 de porción.' },
  'bastante': { factor: 1.5, warning: 'La cantidad "bastante" es ambigua. Asumí 1.5 porciones.' },
  'mucho': { factor: 2, warning: 'La cantidad "mucho" es ambigua. Asumí 2 porciones.' },
  'gusto': { factor: 1, warning: 'La cantidad "a gusto" es ambigua. Asumí 1 porción.' },
};

// Explicit weight units
const WEIGHT_MAP: Record<string, { unit: 'g' | 'ml' | 'kg'; gramsMultiplier?: number }> = {
  'g': { unit: 'g' },
  'gr': { unit: 'g' },
  'gramos': { unit: 'g' },
  'ml': { unit: 'ml' },
  'kg': { unit: 'kg', gramsMultiplier: 1000 },
  'kilo': { unit: 'kg', gramsMultiplier: 1000 },
};

/**
 * Attempts to resolve a quantity expression from the start of a segment.
 * Returns null if no recognizable quantity pattern is found.
 */
export function resolveQuantity(segment: string): ResolvedSegment | null {
  let text = segment.trim();
  if (!text) return null;

  // Strip leading articles
  text = text.replace(/^(el|la|las|los)\s+/i, '');

  // 1. Explicit weight: "200g de pollo", "200 g de pollo", "200gr de pollo", "200ml de leche", "1kg de carne"
  const weightMatch = text.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gramos|ml|kg|kilo)\s*(?:de\s+)?(.+)$/i);
  if (weightMatch) {
    const amount = parseFloat(weightMatch[1]);
    const unitKey = weightMatch[2].toLowerCase();
    const unitInfo = WEIGHT_MAP[unitKey];
    if (unitInfo) {
      const grams = unitInfo.gramsMultiplier ? amount * unitInfo.gramsMultiplier : amount;
      return {
        quantity: 1,
        unit: unitInfo.unit,
        grams,
        isAssumed: false,
        remainingText: weightMatch[3].trim(),
      };
    }
  }

  // 2. "medio kilo de carne"
  const medioKiloMatch = text.match(/^medio\s+kilo\s*(?:de\s+)?(.+)$/i);
  if (medioKiloMatch) {
    return {
      quantity: 1,
      unit: 'kg',
      grams: 500,
      isAssumed: false,
      remainingText: medioKiloMatch[1].trim(),
    };
  }

  // 3. Volume units with optional number: "2 cdas de aceite", "una cda de aceite", "cda de aceite"
  const volumeKeys = Object.keys(VOLUME_UNITS).sort((a, b) => b.length - a.length);
  const wordNumKeys = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length);

  // 3a. Explicit number + volume unit
  const explicitVolRegex = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${volumeKeys.join('|')})\\s*(?:de\\s+)?(.+)$`, 'i');
  const explicitVolMatch = text.match(explicitVolRegex);
  if (explicitVolMatch) {
    const qty = parseFloat(explicitVolMatch[1]);
    const volKey = explicitVolMatch[2].toLowerCase();
    const volInfo = VOLUME_UNITS[volKey];
    if (volInfo) {
      return {
        quantity: qty,
        unit: volInfo.unit,
        grams: volInfo.grams * qty,
        isAssumed: false,
        remainingText: explicitVolMatch[3].trim(),
      };
    }
  }

  // 3b. Word number + volume unit
  const wordVolRegex = new RegExp(`^(${wordNumKeys.join('|')})\\s+(${volumeKeys.join('|')})\\s*(?:de\\s+)?(.+)$`, 'i');
  const wordVolMatch = text.match(wordVolRegex);
  if (wordVolMatch) {
    const wordNum = WORD_NUMBERS[wordVolMatch[1].toLowerCase()];
    if (wordNum !== undefined) {
      const volKey = wordVolMatch[2].toLowerCase();
      const volInfo = VOLUME_UNITS[volKey];
      if (volInfo) {
        return {
          quantity: wordNum,
          unit: volInfo.unit,
          grams: volInfo.grams * wordNum,
          isAssumed: false,
          remainingText: wordVolMatch[3].trim(),
        };
      }
    }
  }

  // 3c. Bare volume unit (implies 1)
  const bareVolRegex = new RegExp(`^(${volumeKeys.join('|')})\\s*(?:de\\s+)?(.+)$`, 'i');
  const bareVolMatch = text.match(bareVolRegex);
  if (bareVolMatch) {
    const volKey = bareVolMatch[1].toLowerCase();
    const volInfo = VOLUME_UNITS[volKey];
    if (volInfo) {
      return {
        quantity: 1,
        unit: volInfo.unit,
        grams: volInfo.grams,
        isAssumed: false,
        remainingText: bareVolMatch[2].trim(),
      };
    }
  }

  // 4. Numeric fractions: "1/4 de pizza", "1/2 pizza", "3/4 de arroz"
  const fractionMatch = text.match(/^(\d+\/\d+)\s*(?:de\s+)?(.+)$/);
  if (fractionMatch) {
    const fractionValue = parseFractionString(fractionMatch[1]);
    if (fractionValue !== null) {
      const remaining = fractionMatch[2].trim();
      const resolved = resolveYMedio(fractionValue, remaining);
      return {
        quantity: resolved.quantity,
        unit: 'portion',
        isAssumed: false,
        remainingText: resolved.remainingText,
      };
    }
  }

  // 5. Word number + food: "una milanesa", "dos huevos", "media porcion de arroz"
  //    (excluding fractions already handled above as standalone)
  const wordNumRegex = new RegExp(`^(${wordNumKeys.join('|')})\\s+(?:de\\s+)?(.+)$`, 'i');
  const wordNumMatch = text.match(wordNumRegex);
  if (wordNumMatch) {
    const wordNum = WORD_NUMBERS[wordNumMatch[1].toLowerCase()];
    if (wordNum !== undefined) {
      let remaining = wordNumMatch[2].trim();
      remaining = remaining.replace(/^(?:porciones?|porcion)\s+(?:de\s+)?/i, '');
      const resolved = resolveYMedio(wordNum, remaining);
      return {
        quantity: resolved.quantity,
        unit: 'portion',
        isAssumed: false,
        remainingText: resolved.remainingText,
      };
    }
  }

  // 6. Number + food: "2 milanesas", "3 huevos", "1.5 porciones de arroz"
  const numMatch = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (numMatch) {
    let quantity = parseFloat(numMatch[1]);
    let remaining = numMatch[2].trim();
    remaining = remaining.replace(/^(?:porciones?|porcion)\s+(?:de\s+)?/i, '');
    const resolved = resolveYMedio(quantity, remaining);
    return {
      quantity: resolved.quantity,
      unit: 'portion',
      isAssumed: false,
      remainingText: resolved.remainingText,
    };
  }

  // 7. Vague quantity phrases: "poco de arroz", "un poco de arroz", "bastante arroz"
  const vagueKeys = Object.keys(VAGUE_SCALE).sort((a, b) => b.length - a.length);
  const vagueRegex = new RegExp(`^(?:un(?:a|os|as)?\\s+)?(${vagueKeys.join('|')})(?:\\s+de)?\\s+(.+)$`, 'i');
  const vagueMatch = text.match(vagueRegex);
  if (vagueMatch) {
    const vagueKey = vagueMatch[1].toLowerCase();
    const scale = VAGUE_SCALE[vagueKey];
    return {
      quantity: scale.factor,
      unit: 'portion',
      isAssumed: true,
      warning: scale.warning,
      remainingText: vagueMatch[2].trim(),
    };
  }

  // No quantity detected
  return null;
}

/**
 * Checks if a food text (without explicit quantity) is a known plural
 * where we can make a safe assumption.
 */
export function assumeQuantityForPlural(foodText: string): { quantity: number; warning?: string } | null {
  const ASSUME_TWO: string[] = [
    'medialunas', 'empanadas', 'croquetas', 'nuggets', 'alitas',
  ];
  const ASK_QUANTITY: string[] = [
    'galletitas', 'facturas', 'alfajores', 'panchos',
    'hamburguesas', 'milanesas', 'huevos', 'tostadas',
  ];

  const lower = foodText.toLowerCase().trim();
  if (ASSUME_TWO.includes(lower)) {
    return { quantity: 2, warning: `Asumí 2 ${foodText}. ¿Fueron más o menos?` };
  }
  if (ASK_QUANTITY.includes(lower)) {
    return { quantity: 1, warning: `¿Cuántas/os ${foodText} comiste? Registré 1 por ahora.` };
  }
  return null;
}

// ─── Internal helpers ─────────────────────────────────────────

function parseFractionString(frac: string): number | null {
  const parts = frac.split('/');
  if (parts.length !== 2) return null;
  const num = parseInt(parts[0], 10);
  const den = parseInt(parts[1], 10);
  if (Number.isNaN(num) || Number.isNaN(den) || den === 0) return null;
  return num / den;
}

function resolveYMedio(quantity: number, text: string): { quantity: number; remainingText: string } {
  const yMedioMatch = text.match(/^(.*?)\s+y\s+(medio|media)$/i);
  if (yMedioMatch) {
    return {
      quantity: quantity + 0.5,
      remainingText: yMedioMatch[1].trim(),
    };
  }
  return { quantity, remainingText: text };
}
