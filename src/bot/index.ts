// ─── Telegram Bot ────────────────────────────────────────────
// Thin client: receives messages, calls backend API, formats responses.

import { Bot, Context, session } from 'grammy';
import { config } from '../config/index.js';
import { logMeal, getDailySummary, getRecommendation, onboardUser } from './api-client.js';
import { formatMealLogged, formatSummary, formatRecommendation, formatOnboardSuccess, formatError } from './formatter.js';

// ─── Session (tracks onboarding state) ──────────────────────

interface SessionData {
  onboarding_step: 'idle' | 'awaiting_weight';
  name: string | null;
}

type BotContext = Context & { session: SessionData };

function initialSession(): SessionData {
  return { onboarding_step: 'idle', name: null };
}

// ─── Bot Setup ───────────────────────────────────────────────

export function createBot(): Bot<BotContext> {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  const bot = new Bot<BotContext>(token);

  bot.use(session({ initial: initialSession }));

  // ── /start → onboarding ──────────────────────────────────
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name || 'amigo';
    ctx.session.name = name;
    ctx.session.onboarding_step = 'awaiting_weight';

    await ctx.reply(
      `¡Hola ${name}! 👋\nSoy tu bot de nutrición.\n\n¿Cuánto pesás? (en kg, ej: 75)`,
    );
  });

  // ── /summary → daily summary ─────────────────────────────
  bot.command('summary', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
      const data = await getDailySummary(telegramId);
      await ctx.reply(formatSummary(data));
    } catch (err) {
      await ctx.reply(formatError(err instanceof Error ? err.message : 'Error desconocido'));
    }
  });

  // ── /recommend → next meal recommendation ────────────────
  bot.command('recommend', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
      const data = await getRecommendation(telegramId);
      await ctx.reply(formatRecommendation(data));
    } catch (err) {
      await ctx.reply(formatError(err instanceof Error ? err.message : 'Error desconocido'));
    }
  });

  // ── Text messages ─────────────────────────────────────────
  bot.on('message:text', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const text = ctx.message.text.trim();

    // Handle onboarding weight step
    if (ctx.session.onboarding_step === 'awaiting_weight') {
      const weight = parseFloat(text.replace(',', '.'));

      if (isNaN(weight) || weight < 30 || weight > 300) {
        await ctx.reply('Mandame tu peso en kg (un número entre 30 y 300). Ej: 75');
        return;
      }

      try {
        const data = await onboardUser(telegramId, ctx.session.name || 'Usuario', weight);
        ctx.session.onboarding_step = 'idle';
        await ctx.reply(formatOnboardSuccess(data.targets));
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('already onboarded')) {
          ctx.session.onboarding_step = 'idle';
          await ctx.reply('Ya tenés perfil creado. Mandame lo que comiste y te lo registro.');
        } else {
          await ctx.reply(formatError(msg));
        }
      }
      return;
    }

    // Default: treat text as meal input → call /log-meal
    try {
      const data = await logMeal(telegramId, text);
      await ctx.reply(formatMealLogged(data));
    } catch (err) {
      await ctx.reply(formatError(err instanceof Error ? err.message : 'Error desconocido'));
    }
  });

  return bot;
}

// ─── Start Bot (long polling) ────────────────────────────────

export async function startBot(): Promise<void> {
  const bot = createBot();

  bot.catch((err: { message: string }) => {
    console.error('[bot] Error:', err.message);
  });

  console.log('🤖 Telegram bot starting...');
  await bot.start();
}

// Allow running standalone: npx tsx src/bot/index.ts
const isMain = process.argv[1]?.includes('bot/index');
if (isMain) {
  startBot().catch((err) => {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  });
}
