// ─── Telegram Bot ────────────────────────────────────────────
// Thin client: receives messages, calls backend API, formats responses.

import { Bot, Context, session, InlineKeyboard } from 'grammy';
import { config } from '../config/index.js';
import { logMeal, getDailySummary, getRecommendation, onboardUser, undoLastMeal, getUserProfile, updateProfile, resetTodayMeals } from './api-client.js';
import { formatMealLogged, formatSummary, formatRecommendation, formatOnboardSuccess, formatUndo, formatStatus, formatProfileUpdated, formatError } from './formatter.js';
import { logger } from '../lib/logger.js';

// ─── Session (tracks onboarding state) ──────────────────────

interface SessionData {
  step:
    | 'idle'
    | 'awaiting_goal'
    | 'awaiting_weight'
    | 'awaiting_update_choice'
    | 'awaiting_update_weight'
    | 'awaiting_update_goal';
  name: string | null;
  goal: string | null;
  // Update profile temp state
  update_choice?: 'weight' | 'goal' | 'both';
  update_weight?: number | null;
  update_goal?: string | null;
}

type BotContext = Context & { session: SessionData };

function initialSession(): SessionData {
  return { step: 'idle', name: null, goal: null };
}

// ─── Bot Setup ───────────────────────────────────────────────

export function createBot(): Bot<BotContext> {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  const bot = new Bot<BotContext>(token);

  bot.use(session({ initial: initialSession }));

  // ── /start → onboarding (step 1: goal) ───────────────────
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    logger.info('bot', 'command', '/start', { user_id: String(telegramId) });
    const name = ctx.from?.first_name || 'amigo';
    ctx.session.name = name;
    ctx.session.step = 'awaiting_goal';
    ctx.session.goal = null;

    await ctx.reply(
      `¡Hola ${name}! 👋\nSoy tu bot de nutrición.\n\n¿Cuál es tu objetivo?\n\n1️⃣ Perder grasa\n2️⃣ Mantener peso\n3️⃣ Ganar músculo\n\nRespondé con 1, 2 o 3.`,
    );
  });

  // ── /updateprofile → update weight or goal ──────────────
  bot.command('updateprofile', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    logger.info('bot', 'command', '/updateprofile', { user_id: String(telegramId) });

    try {
      const profile = await getUserProfile(telegramId);
      ctx.session.step = 'awaiting_update_choice';
      ctx.session.update_choice = undefined;
      ctx.session.update_weight = undefined;
      ctx.session.update_goal = undefined;

      await ctx.reply(
        `📋 Tu perfil actual:\n` +
        `• Peso: ${profile.weight_kg} kg\n` +
        `• Objetivo: ${profile.goal_label}\n` +
        `• Targets: ${profile.targets.calories} cal / ${profile.targets.protein}g prot\n\n` +
        `¿Qué querés actualizar?\n\n` +
        `1️⃣ Peso\n` +
        `2️⃣ Objetivo\n` +
        `3️⃣ Ambos\n\n` +
        `Respondé 1, 2 o 3. (O /cancel para salir)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('bot', 'command_error', `/updateprofile failed: ${msg}`, { user_id: String(telegramId) });
      await ctx.reply(formatError(msg));
    }
  });

  // ── /cancel → abort any active flow ───────────────────────
  bot.command('cancel', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wasActive =
      ctx.session.step === 'awaiting_update_choice' ||
      ctx.session.step === 'awaiting_update_weight' ||
      ctx.session.step === 'awaiting_update_goal';

    if (wasActive) {
      ctx.session.step = 'idle';
      ctx.session.update_choice = undefined;
      ctx.session.update_weight = undefined;
      ctx.session.update_goal = undefined;
      await ctx.reply('❌ Cancelado. Perfil sin cambios.');
    } else {
      await ctx.reply('No había ningún proceso activo para cancelar.');
    }
  });

  // ── /undo → delete last meal ──────────────────────────────
  bot.command('undo', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    logger.info('bot', 'command', '/undo', { user_id: String(telegramId) });

    try {
      const data = await undoLastMeal(telegramId);
      await ctx.reply(formatUndo(data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('bot', 'command_error', `/undo failed: ${msg}`, { user_id: String(telegramId) });
      await ctx.reply(formatError(msg));
    }
  });

  // ── /reset → delete all meals today with confirmation ──────
  bot.command('reset', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    logger.info('bot', 'command', '/reset', { user_id: String(telegramId) });

    const keyboard = new InlineKeyboard()
      .text('✅ Sí, borrar todo', `reset_confirm_${telegramId}`)
      .text('❌ Cancelar', `reset_cancel_${telegramId}`);

    await ctx.reply(
      '⚠️ ¿Estás seguro de que querés borrar TODAS las comidas de hoy?\n\nEsta acción no se puede deshacer.',
      { reply_markup: keyboard },
    );
  });

  // ── Callback: confirm reset ────────────────────────────────
  bot.callbackQuery(/^reset_confirm_(\d+)$/, async (ctx) => {
    const telegramId = Number(ctx.match[1]);
    if (!telegramId) {
      await ctx.answerCallbackQuery('Error de identificación');
      return;
    }

    await ctx.answerCallbackQuery('Borrando...');

    try {
      const data = await resetTodayMeals(telegramId);
      await ctx.editMessageText(
        `🗑️ ${data.deleted_count > 0 ? `Borradas ${data.deleted_count} comidas` : 'No había comidas registradas'} de hoy (${data.date}).`,
      );

      // Show fresh summary (now at zero)
      const summary = await getDailySummary(telegramId);
      await ctx.reply(formatSummary(summary));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('bot', 'command_error', `/reset failed: ${msg}`, { user_id: String(telegramId) });
      await ctx.editMessageText(`❌ No se pudo borrar: ${formatError(msg)}`);
    }
  });

  // ── Callback: cancel reset ─────────────────────────────────
  bot.callbackQuery(/^reset_cancel_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Cancelado');
    await ctx.editMessageText('❌ Borrado cancelado. No se eliminó nada.');
  });

  // ── /summary → daily summary ─────────────────────────────
  bot.command('summary', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    logger.info('bot', 'command', '/summary', { user_id: String(telegramId) });

    try {
      const data = await getDailySummary(telegramId);
      await ctx.reply(formatSummary(data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('bot', 'command_error', `/summary failed: ${msg}`, { user_id: String(telegramId) });
      await ctx.reply(formatError(msg));
    }
  });

  // ── /recommend → next meal recommendation ────────────────
  bot.command('recommend', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    logger.info('bot', 'command', '/recommend', { user_id: String(telegramId) });

    try {
      const data = await getRecommendation(telegramId);
      await ctx.reply(formatRecommendation(data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('bot', 'command_error', `/recommend failed: ${msg}`, { user_id: String(telegramId) });
      await ctx.reply(formatError(msg));
    }
  });

  // ── /status → quick protein/cal check ─────────────────────
  bot.command('status', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    logger.info('bot', 'command', '/status', { user_id: String(telegramId) });

    try {
      const data = await getDailySummary(telegramId);
      await ctx.reply(formatStatus(data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('bot', 'command_error', `/status failed: ${msg}`, { user_id: String(telegramId) });
      await ctx.reply(formatError(msg));
    }
  });

  // ── /help → command list ──────────────────────────────────
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📋 Comandos:\n` +
      `/status — Estado rápido\n` +
      `/summary — Resumen completo\n` +
      `/updateprofile — Actualizar tu peso u objetivo\n` +
      `/recommend — Qué comer\n` +
      `/undo — Deshacer última comida\n` +
      `/reset — Borrar todas las comidas de hoy\n` +
      `/help — Ver comandos\n\n` +
      `Mandame lo que comiste y listo.`,
    );
  });

  // ── Text messages ─────────────────────────────────────────
  bot.on('message:text', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const text = ctx.message.text.trim();

    // ── Update profile step 1: choice ───────────────────────
    if (ctx.session.step === 'awaiting_update_choice') {
      const choiceMap = new Map<string, 'weight' | 'goal' | 'both'>([
        ['1', 'weight'],
        ['2', 'goal'],
        ['3', 'both'],
        ['peso', 'weight'],
        ['objetivo', 'goal'],
        ['ambos', 'both'],
      ]);
      const choice = choiceMap.get(text.toLowerCase());

      if (!choice) {
        await ctx.reply('Elegí una opción:\n1️⃣ Peso\n2️⃣ Objetivo\n3️⃣ Ambos\n\nRespondé 1, 2 o 3. (O /cancel)');
        return;
      }

      ctx.session.update_choice = choice;

      if (choice === 'weight' || choice === 'both') {
        ctx.session.step = 'awaiting_update_weight';
        await ctx.reply('¿Cuál es tu nuevo peso? (en kg, ej: 75)');
      } else {
        ctx.session.step = 'awaiting_update_goal';
        await ctx.reply(
          '¿Cuál es tu nuevo objetivo?\n\n1️⃣ Perder grasa\n2️⃣ Mantener peso\n3️⃣ Ganar músculo\n\nRespondé 1, 2 o 3.',
        );
      }
      return;
    }

    // ── Update profile step 2: weight ───────────────────────
    if (ctx.session.step === 'awaiting_update_weight') {
      const weight = parseFloat(text.replace(',', '.'));

      if (isNaN(weight) || weight < 30 || weight > 300) {
        await ctx.reply('Mandame tu peso en kg (número entre 30 y 300). Ej: 75');
        return;
      }

      ctx.session.update_weight = weight;

      if (ctx.session.update_choice === 'both') {
        ctx.session.step = 'awaiting_update_goal';
        await ctx.reply(
          '¿Cuál es tu nuevo objetivo?\n\n1️⃣ Perder grasa\n2️⃣ Mantener peso\n3️⃣ Ganar músculo\n\nRespondé 1, 2 o 3.',
        );
      } else {
        // Only weight → call API
        try {
          const data = await updateProfile(telegramId, weight, undefined);
          ctx.session.step = 'idle';
          await ctx.reply(formatProfileUpdated(data));
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          ctx.session.step = 'idle';
          await ctx.reply(formatError(msg));
        }
      }
      return;
    }

    // ── Update profile step 3: goal ─────────────────────────
    if (ctx.session.step === 'awaiting_update_goal') {
      const goalMap = new Map<string, string>([
        ['1', 'lose_fat'],
        ['2', 'maintain'],
        ['3', 'gain_muscle'],
        ['perder', 'lose_fat'],
        ['mantener', 'maintain'],
        ['ganar', 'gain_muscle'],
      ]);

      const goal = goalMap.get(text.toLowerCase());
      if (!goal) {
        await ctx.reply('Elegí una opción:\n1️⃣ Perder grasa\n2️⃣ Mantener peso\n3️⃣ Ganar músculo\n\nRespondé 1, 2 o 3.');
        return;
      }

      ctx.session.update_goal = goal;

      const weightToSend = ctx.session.update_choice === 'both' ? ctx.session.update_weight : undefined;

      try {
        const data = await updateProfile(telegramId, weightToSend ?? undefined, goal);
        ctx.session.step = 'idle';
        ctx.session.update_choice = undefined;
        ctx.session.update_weight = undefined;
        ctx.session.update_goal = undefined;
        await ctx.reply(formatProfileUpdated(data));
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        ctx.session.step = 'idle';
        ctx.session.update_choice = undefined;
        ctx.session.update_weight = undefined;
        ctx.session.update_goal = undefined;
        await ctx.reply(formatError(msg));
      }
      return;
    }

    // ── Onboarding step 1: goal selection ───────────────────
    if (ctx.session.step === 'awaiting_goal') {
      const goalMap = new Map<string, string>([
        ['1', 'lose_fat'],
        ['2', 'maintain'],
        ['3', 'gain_muscle'],
        ['perder', 'lose_fat'],
        ['mantener', 'maintain'],
        ['ganar', 'gain_muscle'],
      ]);

      const goal = goalMap.get(text.toLowerCase());
      if (!goal) {
        await ctx.reply('Elegí una opción:\n1️⃣ Perder grasa\n2️⃣ Mantener peso\n3️⃣ Ganar músculo\n\nRespondé 1, 2 o 3.');
        return;
      }

      ctx.session.goal = goal;
      ctx.session.step = 'awaiting_weight';
      await ctx.reply('¿Cuánto pesás? (en kg, ej: 75)');
      return;
    }

    // ── Onboarding step 2: weight ───────────────────────────
    if (ctx.session.step === 'awaiting_weight') {
      const weight = parseFloat(text.replace(',', '.'));

      if (isNaN(weight) || weight < 30 || weight > 300) {
        await ctx.reply('Mandame tu peso en kg (número entre 30 y 300). Ej: 75');
        return;
      }

      try {
        const data = await onboardUser(
          telegramId,
          ctx.session.name || 'Usuario',
          weight,
          ctx.session.goal || undefined,
        );
        ctx.session.step = 'idle';
        await ctx.reply(formatOnboardSuccess(data.targets));
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('already onboarded') || msg.includes('already')) {
          ctx.session.step = 'idle';
          await ctx.reply('Ya tenés perfil creado. Mandame lo que comiste y te lo registro.');
        } else {
          await ctx.reply(formatError(msg));
        }
      }
      return;
    }

    // ── Default: meal logging ───────────────────────────────
    if (text.length < 2) {
      await ctx.reply('Mandame lo que comiste. Ej: "2 huevos y tostadas"');
      return;
    }

    // Guard: detect nonsense input (numbers only, single chars repeated, etc.)
    if (/^[\d\s.,]+$/.test(text)) {
      await ctx.reply('Eso parece un número. Mandame comida, ej: "arroz con pollo"');
      return;
    }

    logger.info('bot', 'meal_text', `user=${telegramId} len=${text.length}`, { user_id: String(telegramId) });

    try {
      const data = await logMeal(telegramId, text);
      await ctx.reply(formatMealLogged(data));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('bot', 'meal_error', errMsg, { user_id: String(telegramId), meta: { text } });
      // Specific message for parsing failures
      if (errMsg.includes('parse') || errMsg.includes('empty')) {
        await ctx.reply('No entendí qué comiste. Intentá ser más específico.\nEj: "2 milanesas con ensalada"');
      } else {
        await ctx.reply(formatError(errMsg));
      }
    }
  });

  // ── Non-text messages (stickers, photos, etc) ─────────────
  bot.on('message', async (ctx) => {
    await ctx.reply('Solo acepto texto. Mandame lo que comiste, ej: "fideos con tuco"');
  });

  return bot;
}

// ─── Start Bot (long polling) ────────────────────────────────

export async function startBot(): Promise<void> {
  const bot = createBot();

  bot.catch((err: { message: string }) => {
    logger.error('bot', 'grammy_error', err.message);
  });

  logger.info('bot', 'bot_start', 'Telegram bot starting (long polling)');
  await bot.start();
}

// Allow running standalone: npx tsx src/bot/index.ts
const isMain = process.argv[1]?.includes('bot/index');
if (isMain) {
  startBot().catch((err) => {
    logger.error('bot', 'start_failed', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
