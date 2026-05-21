// ─── Telegram Message Formatter ──────────────────────────────
// Formats API responses into short, natural Spanish messages.

import type { LogMealApiResponse, SummaryApiResponse, RecommendApiResponse } from './api-client.js';

export function formatMealLogged(data: LogMealApiResponse): string {
  const { meal, daily, recommendation } = data;

  const items = meal.items.map((i) => `• ${i.qty}x ${i.name}`).join('\n');
  const estimated = meal.estimated ? '\n⚠️ Algunos items fueron estimados.' : '';

  let msg = `✅ Registrado:\n${items}${estimated}`;
  msg += `\n\n🥩 +${meal.total.protein}g prot · +${meal.total.calories} cal`;
  msg += `\n\n📊 Hoy: ${daily.consumed.protein}/${daily.targets.protein}g prot · ${daily.consumed.calories}/${daily.targets.calories} cal`;

  if (daily.remaining.protein > 0) {
    msg += `\nFaltan: ${daily.remaining.protein}g prot, ${daily.remaining.calories} cal`;
  } else {
    msg += '\n🎯 ¡Objetivo de proteína alcanzado!';
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
  msg += `\n\nAhora mandame lo que comiste y te lo registro. Ejemplo: "2 milanesas con puré"`;
  return msg;
}

export function formatError(error: string): string {
  if (error.includes('User not found') || error.includes('onboarding')) {
    return '⚠️ No tenés perfil creado. Usá /start para configurar tu cuenta.';
  }
  return `❌ Error: ${error}`;
}
