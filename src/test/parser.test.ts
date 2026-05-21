// ═══════════════════════════════════════════════════════════════
// Parser Integration Tests
// Run: npx tsx src/test/parser.test.ts
// ═══════════════════════════════════════════════════════════════

import { parseMealText } from '../core/parser/index.js';
import type { FoodEntry } from '../types/index.js';

// Minimal food dictionary for testing (mirrors the seed data)
const dictionary: FoodEntry[] = [
  {
    id: 'milanesa_carne', name: 'Milanesa de carne',
    aliases: ['milanesa', 'mila', 'milanga', 'milanesas', 'milas', 'milangas'],
    category: 'carnes', portion_size: 150, portion_unit: 'g',
    nutrition_per_portion: { calories: 320, protein: 22, carbs: 12, fats: 20 },
    nutrition_per_100g: { calories: 213, protein: 15, carbs: 8, fats: 13 },
    is_composite: false, tags: [],
  },
  {
    id: 'pure_papa', name: 'Puré de papa',
    aliases: ['puré', 'pure', 'puré de papa', 'pure de papa'],
    category: 'carbohidratos', portion_size: 200, portion_unit: 'g',
    nutrition_per_portion: { calories: 180, protein: 3, carbs: 35, fats: 5 },
    nutrition_per_100g: { calories: 90, protein: 1.5, carbs: 17, fats: 2.5 },
    is_composite: false, tags: [],
  },
  {
    id: 'fideos', name: 'Fideos cocidos',
    aliases: ['fideos', 'pasta', 'fideos cocidos', 'spaghetti', 'tallarines'],
    category: 'carbohidratos', portion_size: 200, portion_unit: 'g',
    nutrition_per_portion: { calories: 280, protein: 10, carbs: 55, fats: 2 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'fideos_salsa', name: 'Fideos con salsa (tuco)',
    aliases: ['fideos con tuco', 'fideos con salsa', 'tallarines con salsa', 'tuco'],
    category: 'carbohidratos', portion_size: 300, portion_unit: 'g',
    nutrition_per_portion: { calories: 380, protein: 14, carbs: 60, fats: 10 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'tarta_jamon_queso', name: 'Tarta de jamón y queso',
    aliases: ['tarta', 'tarta de jamon y queso', 'tarta jamon queso', 'tartas'],
    category: 'comidas', portion_size: 150, portion_unit: 'g',
    nutrition_per_portion: { calories: 300, protein: 14, carbs: 22, fats: 18 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'carne_asado', name: 'Asado (corte mixto)',
    aliases: ['asado', 'carne', 'parrilla', 'costilla', 'vacio', 'entraña'],
    category: 'carnes', portion_size: 200, portion_unit: 'g',
    nutrition_per_portion: { calories: 400, protein: 40, carbs: 0, fats: 26 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'huevo', name: 'Huevo entero',
    aliases: ['huevo', 'huevos', 'huevo frito', 'huevo duro', 'huevo revuelto'],
    category: 'huevos', portion_size: 60, portion_unit: 'g',
    nutrition_per_portion: { calories: 85, protein: 7, carbs: 0.5, fats: 6 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'pizza_muzza', name: 'Pizza muzzarella (porción)',
    aliases: ['pizza', 'pizza muzza', 'pizza muzzarella', 'porcion de pizza'],
    category: 'comidas', portion_size: 150, portion_unit: 'g',
    nutrition_per_portion: { calories: 350, protein: 14, carbs: 38, fats: 16 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'empanada_carne', name: 'Empanada de carne',
    aliases: ['empanada', 'empanada de carne', 'empanadas'],
    category: 'comidas', portion_size: 100, portion_unit: 'g',
    nutrition_per_portion: { calories: 260, protein: 10, carbs: 22, fats: 14 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'ensalada_mixta', name: 'Ensalada mixta',
    aliases: ['ensalada', 'ensalada mixta', 'ensalada verde'],
    category: 'verduras', portion_size: 150, portion_unit: 'g',
    nutrition_per_portion: { calories: 50, protein: 2, carbs: 8, fats: 1 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  // ── New foods for expanded tests ────────────────────────────
  {
    id: 'chorizo', name: 'Chorizo parrillero',
    aliases: ['chorizo', 'chorizos', 'chori', 'choris', 'chorizo parrillero'],
    category: 'carnes', portion_size: 100, portion_unit: 'g',
    nutrition_per_portion: { calories: 280, protein: 14, carbs: 1, fats: 24 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'bife_chorizo', name: 'Bife de chorizo',
    aliases: ['bife', 'bife de chorizo', 'churrasco', 'bife angosto'],
    category: 'carnes', portion_size: 250, portion_unit: 'g',
    nutrition_per_portion: { calories: 450, protein: 50, carbs: 0, fats: 28 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'milanesa_napolitana', name: 'Milanesa napolitana',
    aliases: ['napo', 'napolitana', 'milanesa napo', 'mila napo', 'napolitanas'],
    category: 'carnes', portion_size: 250, portion_unit: 'g',
    nutrition_per_portion: { calories: 480, protein: 30, carbs: 18, fats: 28 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'alfajor', name: 'Alfajor',
    aliases: ['alfajor', 'alfajores'],
    category: 'snacks', portion_size: 60, portion_unit: 'g',
    nutrition_per_portion: { calories: 260, protein: 3, carbs: 36, fats: 12 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'arroz', name: 'Arroz blanco cocido',
    aliases: ['arroz', 'arroz blanco', 'arroz cocido'],
    category: 'carbohidratos', portion_size: 200, portion_unit: 'g',
    nutrition_per_portion: { calories: 260, protein: 5, carbs: 58, fats: 0.5 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'pechuga_pollo', name: 'Pechuga de pollo a la plancha',
    aliases: ['pechuga', 'pollo', 'pechuga de pollo', 'pollo a la plancha', 'pollo grillado'],
    category: 'carnes', portion_size: 200, portion_unit: 'g',
    nutrition_per_portion: { calories: 240, protein: 46, carbs: 0, fats: 5 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'cerveza', name: 'Cerveza (pinta)',
    aliases: ['cerveza', 'birra', 'pinta'],
    category: 'bebidas', portion_size: 500, portion_unit: 'ml',
    nutrition_per_portion: { calories: 215, protein: 2, carbs: 18, fats: 0 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'noquis', name: 'Ñoquis',
    aliases: ['noquis', 'ñoquis', 'gnocchi'],
    category: 'carbohidratos', portion_size: 300, portion_unit: 'g',
    nutrition_per_portion: { calories: 400, protein: 10, carbs: 65, fats: 10 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'ravioles', name: 'Ravioles',
    aliases: ['ravioles', 'raviolis', 'ravi', 'ravis'],
    category: 'carbohidratos', portion_size: 300, portion_unit: 'g',
    nutrition_per_portion: { calories: 420, protein: 16, carbs: 55, fats: 14 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'arroz_pollo', name: 'Arroz con pollo',
    aliases: ['arroz con pollo'],
    category: 'comidas', portion_size: 350, portion_unit: 'g',
    nutrition_per_portion: { calories: 420, protein: 28, carbs: 50, fats: 10 },
    nutrition_per_100g: null, is_composite: true, tags: [],
  },
  {
    id: 'salchicha', name: 'Salchicha / Pancho',
    aliases: ['salchicha', 'salchichas', 'pancho', 'panchos'],
    category: 'carnes', portion_size: 50, portion_unit: 'g',
    nutrition_per_portion: { calories: 150, protein: 6, carbs: 2, fats: 13 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  // ── Failure pattern test entries ────────────────────────────
  {
    id: 'jamon', name: 'Jamón cocido',
    aliases: ['jamon', 'jamon cocido', 'jamon crudo'],
    category: 'carnes', portion_size: 40, portion_unit: 'g',
    nutrition_per_portion: { calories: 55, protein: 9, carbs: 1, fats: 2 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'verduras_mixtas', name: 'Verduras mixtas',
    aliases: ['verduras', 'verdura', 'verduritas', 'vegetales'],
    category: 'verduras', portion_size: 200, portion_unit: 'g',
    nutrition_per_portion: { calories: 60, protein: 3, carbs: 10, fats: 0.5 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
  {
    id: 'papa', name: 'Papa hervida',
    aliases: ['papa', 'papas', 'papas fritas', 'papas al horno', 'papa frita'],
    category: 'carbohidratos', portion_size: 150, portion_unit: 'g',
    nutrition_per_portion: { calories: 130, protein: 3, carbs: 28, fats: 0.5 },
    nutrition_per_100g: null, is_composite: false, tags: [],
  },
];

// ─── Test Cases ──────────────────────────────────────────────

interface TestCase {
  input: string;
  expectItems: number;
  expectMatched: string[];
  expectUnmatched?: string[];
  expectQty?: Record<string, number>;
}

const tests: TestCase[] = [
  {
    input: '2 milas con pure',
    expectItems: 2,
    expectMatched: ['milanesa_carne', 'pure_papa'],
    expectQty: { milanesa_carne: 2, pure_papa: 1 },
  },
  {
    input: 'fideos con tuco',
    expectItems: 1,
    expectMatched: ['fideos_salsa'],
  },
  {
    input: 'tarta de jamon y queso',
    expectItems: 1,
    expectMatched: ['tarta_jamon_queso'],
  },
  {
    input: 'asado',
    expectItems: 1,
    expectMatched: ['carne_asado'],
  },
  {
    input: '3 huevos y un scoop',
    expectItems: 2,
    expectMatched: ['huevo'],
    expectUnmatched: ['scoop de proteina'],
    expectQty: { huevo: 3 },
  },
  {
    input: 'unos fideos',
    expectItems: 1,
    expectMatched: ['fideos'],
    expectQty: { fideos: 1 },
  },
  {
    input: 'pizza',
    expectItems: 1,
    expectMatched: ['pizza_muzza'],
  },
  {
    input: 'empanadas',
    expectItems: 1,
    expectMatched: ['empanada_carne'],
  },
  {
    input: '2 milanesas, ensalada y pure',
    expectItems: 3,
    expectMatched: ['milanesa_carne', 'ensalada_mixta', 'pure_papa'],
    expectQty: { milanesa_carne: 2 },
  },
  {
    input: '3 empanadas de carne',
    expectItems: 1,
    expectMatched: ['empanada_carne'],
    expectQty: { empanada_carne: 3 },
  },
  // ── New: slang expansion ─────────────────────────────────────
  {
    input: '2 choris',
    expectItems: 1,
    expectMatched: ['chorizo'],
    expectQty: { chorizo: 2 },
  },
  {
    input: 'mila napo con pure',
    expectItems: 2,
    expectMatched: ['milanesa_napolitana', 'pure_papa'],
  },
  {
    input: 'bife con ensalada',
    expectItems: 2,
    expectMatched: ['bife_chorizo', 'ensalada_mixta'],
  },
  // ── New: "+" separator ───────────────────────────────────────
  {
    input: 'arroz + pollo',
    expectItems: 2,
    expectMatched: ['arroz', 'pechuga_pollo'],
  },
  // ── New: compound phrase preserved ───────────────────────────
  {
    input: 'arroz con pollo',
    expectItems: 1,
    expectMatched: ['arroz_pollo'],
  },
  // ── New: vague quantity ──────────────────────────────────────
  {
    input: 'algo de arroz',
    expectItems: 1,
    expectMatched: ['arroz'],
    expectQty: { arroz: 1 },
  },
  // ── New: birra slang ─────────────────────────────────────────
  {
    input: 'una birra',
    expectItems: 1,
    expectMatched: ['cerveza'],
  },
  // ── New: ñoquis with accent ──────────────────────────────────
  {
    input: 'ñoquis',
    expectItems: 1,
    expectMatched: ['noquis'],
  },
  // ── New: pancho slang ────────────────────────────────────────
  {
    input: '2 panchos',
    expectItems: 1,
    expectMatched: ['salchicha'],
    expectQty: { salchicha: 2 },
  },
  // ── New: alfajor ─────────────────────────────────────────────
  {
    input: '2 alfajores',
    expectItems: 1,
    expectMatched: ['alfajor'],
    expectQty: { alfajor: 2 },
  },
  // ── New: ravioles slang ──────────────────────────────────────
  {
    input: 'ravis',
    expectItems: 1,
    expectMatched: ['ravioles'],
  },
  // ═══ FAILURE PATTERN TESTS ═══════════════════════════════════
  // Pattern 1: con-split leaves orphan foods
  {
    input: 'pollo con verduras',
    expectItems: 2,
    expectMatched: ['pechuga_pollo', 'verduras_mixtas'],
  },
  {
    input: 'huevos con jamon',
    expectItems: 2,
    expectMatched: ['huevo', 'jamon'],
  },
  {
    input: 'milanesa con fritas',
    expectItems: 2,
    expectMatched: ['milanesa_carne', 'papa'],
  },
  // Pattern 2: diminutives
  {
    input: 'pollito con arrocito',
    expectItems: 2,
    expectMatched: ['pechuga_pollo', 'arroz'],
  },
  // Pattern 3: verb prefix
  {
    input: 'comi 2 empanadas',
    expectItems: 1,
    expectMatched: ['empanada_carne'],
    expectQty: { empanada_carne: 2 },
  },
  {
    input: 'almorce milanesa con pure',
    expectItems: 2,
    expectMatched: ['milanesa_carne', 'pure_papa'],
  },
  // Pattern 4: cooking modifier as alias
  {
    input: 'pollo frito',
    expectItems: 1,
    expectMatched: ['pechuga_pollo'],
  },
  // Pattern 5: spelling variants
  {
    input: 'espagueti',
    expectItems: 1,
    expectMatched: ['fideos'],
  },
  {
    input: 'tallarin',
    expectItems: 1,
    expectMatched: ['fideos'],
  },
];

// ─── Runner ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const tc of tests) {
  const { result, log } = parseMealText(tc.input, dictionary);
  const errors: string[] = [];

  // Check item count
  if (result.items.length !== tc.expectItems) {
    errors.push(`items: expected ${tc.expectItems}, got ${result.items.length}`);
  }

  // Check matched food IDs
  for (const expectedId of tc.expectMatched) {
    const found = result.items.some((i) => i.food_id === expectedId && i.matched);
    if (!found) {
      errors.push(`expected match for "${expectedId}" not found`);
    }
  }

  // Check unmatched
  if (tc.expectUnmatched) {
    for (const expectedUnmatched of tc.expectUnmatched) {
      const found = result.unmatched.some((u) =>
        u.toLowerCase().includes(expectedUnmatched.toLowerCase()) ||
        expectedUnmatched.toLowerCase().includes(u.toLowerCase())
      );
      if (!found) {
        errors.push(`expected unmatched "${expectedUnmatched}" not found in [${result.unmatched.join(', ')}]`);
      }
    }
  }

  // Check quantities
  if (tc.expectQty) {
    for (const [foodId, expectedQty] of Object.entries(tc.expectQty)) {
      const item = result.items.find((i) => i.food_id === foodId);
      if (!item) {
        errors.push(`qty check: food "${foodId}" not found in items`);
      } else if (item.qty !== expectedQty) {
        errors.push(`qty for "${foodId}": expected ${expectedQty}, got ${item.qty}`);
      }
    }
  }

  if (errors.length > 0) {
    failed++;
    console.log(`❌ FAIL: "${tc.input}"`);
    for (const err of errors) {
      console.log(`   → ${err}`);
    }
    console.log(`   normalized: "${log.normalized}"`);
    console.log(`   tokens:`, log.tokens);
    console.log(`   matches:`, log.matches);
    console.log(`   items:`, result.items.map((i) => `${i.qty}x ${i.food_id} (matched=${i.matched})`));
    console.log('');
  } else {
    passed++;
    console.log(`✅ PASS: "${tc.input}" → [${result.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}] conf=${result.confidence}`);
  }
}

console.log(`\n── Results: ${passed} passed, ${failed} failed, ${tests.length} total ──`);
if (failed > 0) process.exit(1);
