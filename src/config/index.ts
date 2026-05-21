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
    model: 'gemini-2.0-flash',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  defaults: {
    timezone: 'America/Argentina/Buenos_Aires',
    genericFood: {
      calories: 200,
      protein: 10,
      carbs: 20,
      fats: 10,
    },
  },
} as const;
