import { auditMeal } from '../src/core/auditor/index.js';
import type { ParsedItem } from '../src/types/index.js';

// Simulamos los items parseados
const itemsA: ParsedItem[] = [
  { food_id: 'pechuga_pollo', name: 'pechuga', qty: 150, unit: 'g', grams: 150, matched: true },
  { food_id: 'arroz', name: 'arroz', qty: 70, unit: 'g', grams: 70, matched: true },
];

const itemsB: ParsedItem[] = [
  { food_id: 'pizza_muzza', name: 'pizza', qty: 3, unit: 'porcion', grams: 600, matched: true },
  { food_id: 'cerveza', name: 'cerveza', qty: 1, unit: 'porcion', grams: 330, matched: true },
];

async function runTests() {
  console.log('🔄 Ejecutando pruebas del LLM Auditor...');
  
  console.log('\n--- ESCENARIO A (Falta de verdura post-gimnasio) ---');
  console.log('Texto: "Día con entrenamiento. Almuerzo: 150g de pechuga y 70g de arroz"');
  const resultA = await auditMeal("Día con entrenamiento. Almuerzo: 150g de pechuga y 70g de arroz", itemsA, true);
  console.log('Resultado JSON:', JSON.stringify(resultA, null, 2));

  console.log('\n--- ESCENARIO B (Comida trampa post-fútbol dominical) ---');
  console.log('Texto: "Día con entrenamiento. Cena: 3 porciones de pizza y una cerveza"');
  const resultB = await auditMeal("Día con entrenamiento. Cena: 3 porciones de pizza y una cerveza", itemsB, true);
  console.log('Resultado JSON:', JSON.stringify(resultB, null, 2));
}

runTests().catch(console.error);
