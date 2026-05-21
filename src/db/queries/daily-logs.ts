import { supabase } from '../client.js';
import type { DailyLog, NutritionValues } from '../../types/index.js';

export async function getOrCreateDailyLog(userId: string, date: string, targetsSnapshot: NutritionValues): Promise<DailyLog> {
  // Try to get existing log
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (existing) return existing as DailyLog;

  // Create new log for today
  const { data, error } = await supabase
    .from('daily_logs')
    .insert({
      user_id: userId,
      date,
      nutrition_totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
      targets_snapshot: targetsSnapshot,
      meal_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create daily log: ${error.message}`);
  return data as DailyLog;
}

export async function updateDailyLog(logId: string, totals: NutritionValues, mealCount: number): Promise<DailyLog> {
  const { data, error } = await supabase
    .from('daily_logs')
    .update({
      nutrition_totals: totals,
      meal_count: mealCount,
    })
    .eq('id', logId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update daily log: ${error.message}`);
  return data as DailyLog;
}
