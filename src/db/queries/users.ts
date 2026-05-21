import { sql } from '../client.js';
import type { User } from '../../types/index.js';

export async function getUserByTelegramId(telegramId: number): Promise<User | null> {
  const rows = await sql<User[]>`
    SELECT * FROM users WHERE telegram_id = ${telegramId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createUser(user: Partial<User> & { telegram_id: number; weight_kg: number; goal: string; activity_level: string }): Promise<User> {
  const rows = await sql<User[]>`
    INSERT INTO users ${sql(user as Record<string, unknown>)}
    RETURNING *
  `;
  if (!rows[0]) throw new Error('Failed to create user');
  return rows[0];
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  const rows = await sql<User[]>`
    UPDATE users SET ${sql(updates as Record<string, unknown>)}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  if (!rows[0]) throw new Error(`Failed to update user: not found`);
  return rows[0];
}
