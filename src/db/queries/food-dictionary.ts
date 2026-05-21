import { sql } from '../client.js';
import type { FoodEntry } from '../../types/index.js';

export async function getAllFoods(): Promise<FoodEntry[]> {
  const rows = await sql<FoodEntry[]>`SELECT * FROM food_dictionary`;
  return rows;
}

export async function getFoodById(id: string): Promise<FoodEntry | null> {
  const rows = await sql<FoodEntry[]>`
    SELECT * FROM food_dictionary WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function searchFoodByAlias(alias: string): Promise<FoodEntry | null> {
  const rows = await sql<FoodEntry[]>`
    SELECT * FROM food_dictionary WHERE aliases @> ARRAY[${alias}]::text[] LIMIT 1
  `;
  return rows[0] ?? null;
}
