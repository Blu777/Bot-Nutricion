// ─── In-memory Metrics Store ──────────────────────────────────
// No external dependencies. Resets on container restart.

const startTime = Date.now();

let requestsTotal = 0;
let latencySum = 0;
let latencyCount = 0;
let geminiCalls = 0;
let parseFailures = 0;
let unknownFoodHits = 0;
let totalMealLogs = 0;

const requestsPerRoute: Record<string, number> = {};

export const metrics = {
  incRequest(route: string): void {
    requestsTotal++;
    requestsPerRoute[route] = (requestsPerRoute[route] ?? 0) + 1;
  },

  recordLatency(ms: number): void {
    latencySum += ms;
    latencyCount++;
  },

  incGeminiCall(): void {
    geminiCalls++;
  },

  incParseFailure(): void {
    parseFailures++;
  },

  incUnknownFood(): void {
    unknownFoodHits++;
  },

  incMealLog(): void {
    totalMealLogs++;
  },

  snapshot() {
    return {
      uptime: Math.floor((Date.now() - startTime) / 1000),
      requests_total: requestsTotal,
      requests_per_route: { ...requestsPerRoute },
      avg_latency_ms: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
      gemini_calls: geminiCalls,
      parse_failures: parseFailures,
      unknown_food_hits: unknownFoodHits,
      total_meal_logs: totalMealLogs,
      fallback_rate: totalMealLogs > 0
        ? Math.round((geminiCalls / totalMealLogs) * 100) / 100
        : 0,
    };
  },
};
