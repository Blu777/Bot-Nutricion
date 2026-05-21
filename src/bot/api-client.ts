// ─── Bot → Backend API Client ─────────────────────────────────
// The bot calls the backend API over HTTP. No logic duplication.

import { config } from '../config/index.js';

const BASE = config.apiBaseUrl;

export interface LogMealApiResponse {
  meal: {
    id: string;
    items: Array<{ name: string; qty: number; matched: boolean; nutrition: { calories: number; protein: number; carbs: number; fats: number } }>;
    total: { calories: number; protein: number; carbs: number; fats: number };
    confidence: number;
    estimated: boolean;
    unmatched: string[];
  };
  daily: {
    consumed: { calories: number; protein: number; carbs: number; fats: number };
    targets: { calories: number; protein: number; carbs: number; fats: number };
    remaining: { calories: number; protein: number; carbs: number; fats: number };
  };
  recommendation: { text: string; suggested_foods: string[] };
  message: string;
}

export interface SummaryApiResponse {
  date: string;
  totals: { calories: number; protein: number; carbs: number; fats: number };
  targets: { calories: number; protein: number; carbs: number; fats: number };
  remaining: { calories: number; protein: number; carbs: number; fats: number };
  progress_pct: { calories: number; protein: number; carbs: number; fats: number };
  recommendation: { text: string; suggested_foods: string[] };
}

export interface OnboardApiResponse {
  user_id: string;
  targets: { calories: number; protein: number; carbs: number; fats: number };
  message: string;
}

export interface RecommendApiResponse {
  recommendation: { text: string; suggested_foods: string[] };
}

export async function logMeal(telegramId: number, text: string): Promise<LogMealApiResponse> {
  const res = await fetch(`${BASE}/api/log-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id: telegramId, text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json() as Promise<LogMealApiResponse>;
}

export async function getDailySummary(telegramId: number): Promise<SummaryApiResponse> {
  const res = await fetch(`${BASE}/api/daily-summary?telegram_id=${telegramId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json() as Promise<SummaryApiResponse>;
}

export async function getRecommendation(telegramId: number): Promise<RecommendApiResponse> {
  const res = await fetch(`${BASE}/api/recommendation?telegram_id=${telegramId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json() as Promise<RecommendApiResponse>;
}

export async function onboardUser(
  telegramId: number,
  name: string,
  weightKg: number,
  goal?: string,
): Promise<OnboardApiResponse> {
  const res = await fetch(`${BASE}/api/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id: telegramId, name, weight_kg: weightKg, goal }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json() as Promise<OnboardApiResponse>;
}

export interface UndoMealApiResponse {
  undone: {
    text: string;
    nutrition: { calories: number; protein: number; carbs: number; fats: number };
  };
  daily: {
    consumed: { calories: number; protein: number; carbs: number; fats: number };
    targets: { calories: number; protein: number; carbs: number; fats: number };
  };
}

export async function undoLastMeal(telegramId: number): Promise<UndoMealApiResponse> {
  const res = await fetch(`${BASE}/api/undo-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id: telegramId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json() as Promise<UndoMealApiResponse>;
}
