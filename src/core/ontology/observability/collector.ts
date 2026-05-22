// ─── Metrics Collector ────────────────────────────────────────
// In-memory ring buffer for nutrition resolution metrics.
// Ring size: 10 000 entries (~last N resolutions in production).
// All writes are synchronous in-process — zero I/O on hot path.
// Reads (aggregation) happen only on demand (endpoint call).

import type {
  NutritionResolutionMetric,
  ResolutionPath,
  AggregatedMetrics,
  ObservabilityAlert,
} from './types.js';

const RING_SIZE = 10_000;

// ── Ring buffer ───────────────────────────────────────────────
const ring: (NutritionResolutionMetric | undefined)[] = new Array(RING_SIZE);
let head = 0;
let count = 0;

// ── Alert thresholds ──────────────────────────────────────────
const THRESHOLDS = {
  HIGH_FALLBACK_RATE:    0.10,
  HIGH_UNKNOWN_RATE:     0.05,
  MEDIUM_LOW_CONFIDENCE: 0.75,
  MEDIUM_UNRESOLVED_ABS: 20,
} as const;

// ── Internal: write to ring ───────────────────────────────────
function pushMetric(m: NutritionResolutionMetric): void {
  ring[head % RING_SIZE] = m;
  head++;
  if (count < RING_SIZE) count++;
}

// ── Public: record a single resolution ───────────────────────
export function recordResolution(m: NutritionResolutionMetric): void {
  // Fire-and-forget from caller's perspective — no throws
  try {
    pushMetric(m);
  } catch {
    // Observability must never crash the main flow
  }
}

// ── Internal: iterate valid entries ──────────────────────────
function* iterEntries(): Generator<NutritionResolutionMetric> {
  const total = Math.min(count, RING_SIZE);
  const start = count >= RING_SIZE ? head % RING_SIZE : 0;
  for (let i = 0; i < total; i++) {
    const entry = ring[(start + i) % RING_SIZE];
    if (entry) yield entry;
  }
}

// ── Path → confidence mapping ─────────────────────────────────
function pathToConfidence(path: ResolutionPath): number {
  switch (path) {
    case 'EXACT_MATCH':             return 1.0;
    case 'CONCEPT_PLUS_PREPARATION': return 0.95;
    case 'CONCEPT_MATCH':           return 0.85;
    case 'FALLBACK_CATEGORY':       return 0.40;
    case 'FAILED':                  return 0.0;
  }
}

// ── Aggregator ────────────────────────────────────────────────
export function aggregateMetrics(windowSeconds?: number): AggregatedMetrics {
  const now = Date.now();
  const cutoff = windowSeconds ? now - windowSeconds * 1000 : 0;

  const pathCounts: Record<ResolutionPath, number> = {
    EXACT_MATCH: 0,
    CONCEPT_MATCH: 0,
    CONCEPT_PLUS_PREPARATION: 0,
    FALLBACK_CATEGORY: 0,
    FAILED: 0,
  };

  let totalConf = 0;
  let total = 0;
  let confHigh = 0;
  let confMedium = 0;
  let confLow = 0;

  for (const m of iterEntries()) {
    if (m.timestamp < cutoff) continue;
    total++;
    pathCounts[m.resolutionPath]++;
    totalConf += m.confidence;

    if (m.confidence >= 0.85)      confHigh++;
    else if (m.confidence >= 0.60) confMedium++;
    else                           confLow++;
  }

  const resolved = total - pathCounts.FAILED;
  const fallbackCount = pathCounts.FALLBACK_CATEGORY;
  const unknownCount = pathCounts.FAILED;

  const exactMatchRate          = total > 0 ? pathCounts.EXACT_MATCH / total : 0;
  const conceptMatchRate        = total > 0 ? pathCounts.CONCEPT_MATCH / total : 0;
  const conceptPlusPrepRate     = total > 0 ? pathCounts.CONCEPT_PLUS_PREPARATION / total : 0;
  const fallbackRate            = total > 0 ? fallbackCount / total : 0;
  const unknownFoodRate         = total > 0 ? unknownCount / total : 0;
  const averageConfidence       = total > 0 ? totalConf / total : 1;
  const ontologyCoveragePercent = total > 0
    ? Math.round(((pathCounts.EXACT_MATCH + pathCounts.CONCEPT_MATCH + pathCounts.CONCEPT_PLUS_PREPARATION) / total) * 100)
    : 100;

  const alerts = buildAlerts({ fallbackRate, unknownFoodRate, averageConfidence, unknownCount });

  return {
    totalResolutions: total,
    exactMatchRate:       Math.round(exactMatchRate * 1000) / 1000,
    conceptMatchRate:     Math.round(conceptMatchRate * 1000) / 1000,
    conceptPlusPrepRate:  Math.round(conceptPlusPrepRate * 1000) / 1000,
    fallbackRate:         Math.round(fallbackRate * 1000) / 1000,
    unknownFoodRate:      Math.round(unknownFoodRate * 1000) / 1000,
    averageConfidence:    Math.round(averageConfidence * 1000) / 1000,
    ontologyCoveragePercent,
    confidenceDistribution: {
      high:   total > 0 ? Math.round((confHigh   / total) * 1000) / 1000 : 0,
      medium: total > 0 ? Math.round((confMedium / total) * 1000) / 1000 : 0,
      low:    total > 0 ? Math.round((confLow    / total) * 1000) / 1000 : 0,
    },
    pathCounts,
    topUnknownFoods: getTopUnknownFoods(10),
    alerts,
    windowSeconds: windowSeconds ?? 0,
    sampledAt: now,
  };
}

// ── Alert builder ─────────────────────────────────────────────
function buildAlerts(params: {
  fallbackRate: number;
  unknownFoodRate: number;
  averageConfidence: number;
  unknownCount: number;
}): ObservabilityAlert[] {
  const alerts: ObservabilityAlert[] = [];
  const now = Date.now();

  if (params.fallbackRate > THRESHOLDS.HIGH_FALLBACK_RATE) {
    alerts.push({
      severity: 'HIGH',
      code: 'HIGH_FALLBACK_RATE',
      message: `Tasa de fallback (${(params.fallbackRate * 100).toFixed(1)}%) supera el umbral del ${THRESHOLDS.HIGH_FALLBACK_RATE * 100}%`,
      value: params.fallbackRate,
      threshold: THRESHOLDS.HIGH_FALLBACK_RATE,
      timestamp: now,
    });
  }

  if (params.unknownFoodRate > THRESHOLDS.HIGH_UNKNOWN_RATE) {
    alerts.push({
      severity: 'HIGH',
      code: 'HIGH_UNKNOWN_FOOD_RATE',
      message: `Tasa de alimentos no resueltos (${(params.unknownFoodRate * 100).toFixed(1)}%) supera el umbral del ${THRESHOLDS.HIGH_UNKNOWN_RATE * 100}%`,
      value: params.unknownFoodRate,
      threshold: THRESHOLDS.HIGH_UNKNOWN_RATE,
      timestamp: now,
    });
  }

  if (params.averageConfidence < THRESHOLDS.MEDIUM_LOW_CONFIDENCE) {
    alerts.push({
      severity: 'MEDIUM',
      code: 'LOW_AVERAGE_CONFIDENCE',
      message: `Confianza promedio (${params.averageConfidence.toFixed(3)}) está por debajo del umbral mínimo (${THRESHOLDS.MEDIUM_LOW_CONFIDENCE})`,
      value: params.averageConfidence,
      threshold: THRESHOLDS.MEDIUM_LOW_CONFIDENCE,
      timestamp: now,
    });
  }

  if (params.unknownCount > THRESHOLDS.MEDIUM_UNRESOLVED_ABS) {
    alerts.push({
      severity: 'MEDIUM',
      code: 'HIGH_UNRESOLVED_COUNT',
      message: `Cantidad de alimentos no resueltos (${params.unknownCount}) supera el umbral absoluto (${THRESHOLDS.MEDIUM_UNRESOLVED_ABS})`,
      value: params.unknownCount,
      threshold: THRESHOLDS.MEDIUM_UNRESOLVED_ABS,
      timestamp: now,
    });
  }

  return alerts;
}

// ── Ring snapshot (raw, for debugging) ───────────────────────
export function getRingSnapshot(limit = 50): NutritionResolutionMetric[] {
  const result: NutritionResolutionMetric[] = [];
  for (const m of iterEntries()) {
    result.push(m);
    if (result.length >= limit) break;
  }
  return result.reverse();
}

// ── Reset (for testing) ────────────────────────────────────────
export function resetMetrics(): void {
  ring.fill(undefined);
  head = 0;
  count = 0;
  unknownFoodsMap.clear();
}

// ── Unknown food tracker (separate structure for O(1) freq update) ─
const unknownFoodsMap = new Map<string, { input: string; normalizedInput: string; frequency: number; lastSeen: number }>();

export function trackUnknownFoodResolution(input: string, normalizedInput: string): void {
  try {
    const key = normalizedInput;
    const existing = unknownFoodsMap.get(key);
    if (existing) {
      existing.frequency++;
      existing.lastSeen = Date.now();
    } else {
      unknownFoodsMap.set(key, { input, normalizedInput, frequency: 1, lastSeen: Date.now() });
    }
  } catch {
    // Never throws
  }
}

export function getTopUnknownFoods(limit = 20): Array<{ input: string; normalizedInput: string; frequency: number; lastSeen: number }> {
  return [...unknownFoodsMap.values()]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}
