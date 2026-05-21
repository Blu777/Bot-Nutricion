import { supabase } from '../client.js';
import type { FoodEntry } from '../../types/index.js';

export async function getAllFoods(): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('food_dictionary')
    .select('*');

  if (error) throw new Error(`Failed to fetch food dictionary: ${error.message}`);
  return (data || []) as FoodEntry[];
}

export async function getFoodById(id: string): Promise<FoodEntry | null> {
  const { data, error } = await supabase
    .from('food_dictionary')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as FoodEntry;
}

export async function searchFoodByAlias(alias: string): Promise<FoodEntry | null> {
  const { data, error } = await supabase
    .from('food_dictionary')
    .select('*')
    .contains('aliases', [alias]);

  if (error || !data || data.length === 0) return null;
  return data[0] as FoodEntry;
}
