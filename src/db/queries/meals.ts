import { supabase } from '../client.js';
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
  const { data, error } = await supabase
    .from('meals')
    .insert(params)
    .select()
    .single();

  if (error) throw new Error(`Failed to create meal: ${error.message}`);
  return data as Meal;
}

export async function getMealsByUserAndDate(userId: string, date: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('logged_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch meals: ${error.message}`);
  return (data || []) as Meal[];
}

export async function getLastMeal(userId: string, date: string): Promise<Meal | null> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('logged_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as Meal;
}

export async function deleteMeal(mealId: string): Promise<void> {
  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', mealId);

  if (error) throw new Error(`Failed to delete meal: ${error.message}`);
}
