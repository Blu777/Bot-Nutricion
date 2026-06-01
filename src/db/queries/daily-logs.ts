import { sql } from '../client.js';
import type { DailyLog, NutritionValues } from '../../types/index.js';

export async function getOrCreateDailyLog(userId: string, date: string, targetsSnapshot: NutritionValues, isTrainingDay: boolean = false): Promise<DailyLog> {
  const existing = await sql<DailyLog[]>`
    SELECT * FROM daily_logs WHERE user_id = ${userId} AND date = ${date} LIMIT 1
  `;
  if (existing[0]) return existing[0];

  const rows = await sql<DailyLog[]>`
    INSERT INTO daily_logs (user_id, date, nutrition_totals, targets_snapshot, meal_count, is_training_day)
    VALUES (
      ${userId},
      ${date},
      ${sql.json({ calories: 0, protein: 0, carbs: 0, fats: 0 })},
      ${sql.json(targetsSnapshot)},
      0,
      ${isTrainingDay}
    )
    RETURNING *
  `;
  if (!rows[0]) throw new Error('Failed to create daily log');
  return rows[0];
}

export async function updateDailyLog(logId: string, totals: NutritionValues, mealCount: number, isTrainingDay?: boolean): Promise<DailyLog> {
  let rows;
  if (isTrainingDay !== undefined) {
    rows = await sql<DailyLog[]>`
      UPDATE daily_logs
      SET nutrition_totals = ${sql.json(totals)}, meal_count = ${mealCount}, is_training_day = ${isTrainingDay}, updated_at = NOW()
      WHERE id = ${logId}
      RETURNING *
    `;
  } else {
    rows = await sql<DailyLog[]>`
      UPDATE daily_logs
      SET nutrition_totals = ${sql.json(totals)}, meal_count = ${mealCount}, updated_at = NOW()
      WHERE id = ${logId}
      RETURNING *
    `;
  }
  if (!rows[0]) throw new Error('Failed to update daily log: not found');
  return rows[0];
}
