export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
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
