import { supabase } from '../client.js';
import type { User } from '../../types/index.js';

export async function getUserByTelegramId(telegramId: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error || !data) return null;
  return data as User;
}

export async function createUser(user: Partial<User> & { telegram_id: number; weight_kg: number; goal: string; activity_level: string }): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert(user)
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as User;
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update user: ${error.message}`);
  return data as User;
}
