import { sql } from '../client.js';
import type { Meal, ParsedItem, NutritionValues } from '../../types/index.js';

export async function createMeal(params: {
  user_id: string;
  raw_text: string;
  parsed_items: ParsedItem[];
  nutrition: NutritionValues;
  parse_method: string;
  confidence: number;
  date: string;
}): Promise<Meal> {
  const rows = await sql<Meal[]>`
    INSERT INTO meals (user_id, raw_text, parsed_items, nutrition, parse_method, confidence, date)
    VALUES (
      ${params.user_id},
      ${params.raw_text},
      ${sql.json(params.parsed_items as any)},
      ${sql.json(params.nutrition as any)},
      ${params.parse_method},
      ${params.confidence},
      ${params.date}
    )
    RETURNING *
  `;
  if (!rows[0]) throw new Error('Failed to create meal');
  return rows[0];
}

export async function getMealsByUserAndDate(userId: string, date: string): Promise<Meal[]> {
  const rows = await sql<Meal[]>`
    SELECT * FROM meals
    WHERE user_id = ${userId} AND date = ${date}
    ORDER BY logged_at ASC
  `;
  return rows;
}

export async function getLastMeal(userId: string, date: string): Promise<Meal | null> {
  const rows = await sql<Meal[]>`
    SELECT * FROM meals
    WHERE user_id = ${userId} AND date = ${date}
    ORDER BY logged_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function deleteMeal(mealId: string): Promise<void> {
  await sql`DELETE FROM meals WHERE id = ${mealId}`;
}

export async function deleteTodayMeals(userId: string, date: string): Promise<number> {
  const result = await sql`
    DELETE FROM meals
    WHERE user_id = ${userId} AND date = ${date}
  `;
  return (result as unknown as { count: number }).count ?? 0;
}
