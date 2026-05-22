import postgres from 'postgres';
import fs from 'fs/promises';
import path from 'path';

import { fileURLToPath } from 'url';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nutrition';
const sql = postgres(DATABASE_URL);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  console.log('🔄 Running database migrations...');

  try {
    // Ensure migrations table exists
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Read all SQL files from the migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    let files: string[] = [];
    try {
      files = await fs.readdir(migrationsDir);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log('No migrations directory found. Skipping migrations.');
        return;
      }
      throw err;
    }

    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    // Get executed migrations
    const executed = await sql`SELECT name FROM _migrations`;
    const executedSet = new Set(executed.map(row => row.name));

    let count = 0;
    for (const file of sqlFiles) {
      if (!executedSet.has(file)) {
        console.log(`   Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // Execute the migration and record it
        await sql.begin(async (tx) => {
          await tx.unsafe(fileContent);
          await tx`INSERT INTO _migrations (name) VALUES (${file})`;
        });

        count++;
      }
    }

    if (count === 0) {
      console.log('✅ Database is already up to date.');
    } else {
      console.log(`✅ Successfully applied ${count} migration(s).`);
    }
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
