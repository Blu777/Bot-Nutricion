export function validateEnv(required: string[]): void {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[config] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const config = {
  env: (process.env.NODE_ENV || 'development') as 'development' | 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nutrition',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  apiSecret: process.env.API_SECRET || '',
  defaults: {
    timezone: 'America/Argentina/Buenos_Aires',
  },
} as const;
