// ─── Telegram Message Formatter ──────────────────────────────
// Formats API responses into short, natural Spanish messages.

import type { LogMealApiResponse, SummaryApiResponse, RecommendApiResponse, UndoMealApiResponse } from './api-client.js';

export function formatMealLogged(data: LogMealApiResponse): string {
  const { meal, daily, recommendation } = data;

  const items = meal.items.map((i) => {
    const mark = i.matched ? '•' : '•❓';
    return `${mark} ${i.qty}x ${i.name}`;
  }).join('\n');

  let msg = `✅ Registrado:\n${items}`;

  // Show clearer unmatched warning with item names
  if (meal.unmatched.length > 0) {
    const genericCal = 210;
    msg += `\n\n⚠️ No reconocí: "${meal.unmatched.join('", "')}"`;
    msg += `\nEstimé ~${genericCal} cal por ítem (puede variar ±40%).`;
    msg += `\nSi la porción fue muy diferente, decime el gramaje.`;
  }

  msg += `\n\n🥩 +${meal.total.protein}g prot · +${meal.total.calories} cal`;
  msg += `\n📊 Hoy: ${daily.consumed.protein}/${daily.targets.protein}g prot · ${daily.consumed.calories}/${daily.targets.calories} cal`;

  if (daily.remaining.protein > 0) {
    msg += `\nFaltan: ${daily.remaining.protein}g prot, ${daily.remaining.calories} cal`;
  } else {
    msg += '\n🎯 ¡Objetivo de proteína alcanzado!';
  }

  // Avisos contextuales por alimento (máximo 3)
  let warningCount = 0;
  const MAX_WARNINGS = 3;

  const hasMilanesa = meal.items.some((i) =>
    i.food_id === 'milanesa_carne' || i.food_id === 'milanesa'
  );
  if (hasMilanesa && warningCount < MAX_WARNINGS) {
    msg += `\n🍳 Registré como milanesa frita (~320 cal/u).`;
    msg += ` Al horno serían ~250 cal/u. ¿Cuál fue?`;
    warningCount++;
  }

  const hasSalad = meal.items.some((i) =>
    i.food_id?.includes('ensalada')
  );
  if (hasSalad && warningCount < MAX_WARNINGS) {
    msg += `\n🥗 Ensalada sin aderezo (~50 cal).`;
    msg += ` Con aceite de oliva: +100–120 cal.`;
    warningCount++;
  }

  const hasAsado = meal.items.some((i) =>
    i.food_id === 'carne_asado'
  );
  if (hasAsado && warningCount < MAX_WARNINGS) {
    msg += `\n🥩 Asado estimado como corte mixto (~400 cal).`;
    msg += ` Varía: vacío ~350 | costilla ~480 | entraña ~390.`;
    warningCount++;
  }

  const hasGalletitas = meal.items.some((i) =>
    i.food_id?.includes('galletitas')
  );
  if (hasGalletitas && warningCount < MAX_WARNINGS) {
    msg += `\n🍪 Galletitas: registré porción estándar (~30g = 6 unidades).`;
    msg += ` Si comiste más, decime cuántas.`;
    warningCount++;
  }

  const hasPure = meal.items.some((i) =>
    i.food_id === 'pure_papa'
  );
  if (hasPure && warningCount < MAX_WARNINGS) {
    msg += `\n🥔 Puré estimado con manteca (~105 cal/100g).`;
    msg += ` Sin manteca serían ~72 cal/100g.`;
    warningCount++;
  }

  // Warnings de cantidad asumida (plural sin número explícito)
  if ((meal.quantity_warnings?.length ?? 0) > 0) {
    meal.quantity_warnings!.slice(0, MAX_WARNINGS - warningCount).forEach((w) => {
      msg += `\n📌 ${w}`;
      warningCount++;
    });
  }

  if (recommendation.text) {
    msg += `\n\n💡 ${recommendation.text}`;
  }

  return msg;
}

export function formatSummary(data: SummaryApiResponse): string {
  const { totals, targets, progress_pct, recommendation } = data;

  let msg = `📊 Resumen del día:\n`;
  msg += `\n🔥 Calorías: ${totals.calories}/${targets.calories} (${progress_pct.calories}%)`;
  msg += `\n🥩 Proteína: ${totals.protein}/${targets.protein}g (${progress_pct.protein}%)`;
  msg += `\n🍞 Carbos: ${totals.carbs}/${targets.carbs}g (${progress_pct.carbs}%)`;
  msg += `\n🧈 Grasas: ${totals.fats}/${targets.fats}g (${progress_pct.fats}%)`;

  if (recommendation.text) {
    msg += `\n\n💡 ${recommendation.text}`;
  }

  return msg;
}

export function formatRecommendation(data: RecommendApiResponse): string {
  return `💡 ${data.recommendation.text}`;
}

export function formatOnboardSuccess(targets: { calories: number; protein: number; carbs: number; fats: number }): string {
  let msg = `✅ ¡Listo! Tu perfil está configurado.\n`;
  msg += `\n🎯 Objetivos diarios:`;
  msg += `\n• ${targets.calories} calorías`;
  msg += `\n• ${targets.protein}g proteína`;
  msg += `\n• ${targets.carbs}g carbos`;
  msg += `\n• ${targets.fats}g grasas`;
  msg += `\n\nMandame lo que comiste y te lo registro.`;
  msg += `\nEj: "2 milanesas con puré"`;
  return msg;
}

export function formatStatus(data: SummaryApiResponse): string {
  const { totals, targets } = data;
  const protRemaining = Math.max(0, targets.protein - totals.protein);
  const calRemaining = Math.max(0, targets.calories - totals.calories);

  let msg = `📊 ${totals.protein}/${targets.protein}g prot · ${totals.calories}/${targets.calories} cal`;

  if (protRemaining > 0) {
    msg += `\nTe faltan ~${protRemaining}g prot y ~${calRemaining} cal`;
  } else {
    msg += `\n🎯 ¡Proteína completa!`;
    if (calRemaining > 0) {
      msg += ` Faltan ~${calRemaining} cal`;
    }
  }

  return msg;
}

export function formatUndo(data: UndoMealApiResponse): string {
  let msg = `↩️ Deshecho: "${data.undone.text}"`;
  msg += `\n(-${data.undone.nutrition.protein}g prot, -${data.undone.nutrition.calories} cal)`;
  msg += `\n\n📊 Hoy: ${data.daily.consumed.protein}/${data.daily.targets.protein}g prot · ${data.daily.consumed.calories}/${data.daily.targets.calories} cal`;
  return msg;
}

export function formatError(error: string): string {
  if (error.includes('User not found') || error.includes('onboarding')) {
    return '⚠️ No tenés perfil creado. Usá /start para configurar tu cuenta.';
  }
  if (error.includes('No hay comidas')) {
    return '⚠️ No hay comidas registradas hoy para deshacer.';
  }
  if (error.includes('No pude interpretar') || error.includes('interpretar')) {
    return '🤔 No entendí qué comiste. Intentá ser más específico.\nEj: "pollo con arroz" en vez de "comida"';
  }
  if (error.includes('fetch') || error.includes('ECONNREFUSED') || error.includes('network')) {
    return '❌ No pude conectar con el servidor. Intentá de nuevo en unos segundos.';
  }
  if (error.includes('API error 5') || error.includes('500')) {
    return '❌ Error del servidor. Intentá de nuevo en un momento.';
  }
  return `❌ Algo salió mal. Intentá de nuevo o usá /summary para ver tu estado.`;
}
