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
