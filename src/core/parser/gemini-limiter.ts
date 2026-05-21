// ─── Gemini Rate Limiter & Cache ──────────────────────────────
// - Max 1 call per user every 10 seconds
// - Caches input → mapping results to avoid redundant calls

const RATE_LIMIT_MS = 10_000; // 10 seconds per user
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes cache

// user_id → last call timestamp
const rateLimitMap = new Map<string, number>();

// normalized_input → { result, timestamp }
const responseCache = new Map<string, { result: unknown; timestamp: number }>();

export function isRateLimited(userId: string): boolean {
  const lastCall = rateLimitMap.get(userId);
  if (!lastCall) return false;
  return Date.now() - lastCall < RATE_LIMIT_MS;
}

export function markGeminiCall(userId: string): void {
  rateLimitMap.set(userId, Date.now());
}

export function getCachedResult(normalizedInput: string): unknown | null {
  const entry = responseCache.get(normalizedInput);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(normalizedInput);
    return null;
  }

  return entry.result;
}

export function setCachedResult(normalizedInput: string, result: unknown): void {
  responseCache.set(normalizedInput, { result, timestamp: Date.now() });

  // Prevent unbounded growth (keep last 100 entries)
  if (responseCache.size > 100) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
}
