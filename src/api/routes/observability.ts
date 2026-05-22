// ─── GET /nutrition/observability/summary ─────────────────────
// Returns live aggregated metrics from the ontology resolution ring buffer.
//
// Optional query params:
//   ?window=<seconds>   — restrict to last N seconds (default: all time)
//   ?detail=true        — include raw discovery queue candidates

import { Hono } from 'hono';
import { aggregateMetrics, getRingSnapshot } from '../../core/ontology/observability/collector.js';
import { buildDiscoveryQueue } from '../../core/ontology/observability/discovery.js';
import { FOOD_CONCEPTS } from '../../core/ontology/graph.js';
import { logger } from '../../lib/logger.js';

export const observabilityRoutes = new Hono();

observabilityRoutes.get('/nutrition/observability/summary', (c) => {
  try {
    const windowParam = c.req.query('window');
    const detail = c.req.query('detail') === 'true';
    const windowSeconds = windowParam ? parseInt(windowParam, 10) : undefined;

    const aggregated = aggregateMetrics(windowSeconds);
    const discoveryQueue = buildDiscoveryQueue(20);

    const ontologyConceptCount = Object.keys(FOOD_CONCEPTS).length;

    const response: Record<string, unknown> = {
      sampled_at: new Date(aggregated.sampledAt).toISOString(),
      window_seconds: windowSeconds ?? 'all_time',
      ontology: {
        concept_count: ontologyConceptCount,
        coverage_percent: aggregated.ontologyCoveragePercent,
      },
      rates: {
        exact_match:           aggregated.exactMatchRate,
        concept_match:         aggregated.conceptMatchRate,
        concept_plus_prep:     aggregated.conceptPlusPrepRate,
        fallback_category:     aggregated.fallbackRate,
        unknown_food:          aggregated.unknownFoodRate,
      },
      totals: {
        resolutions: aggregated.totalResolutions,
        ...aggregated.pathCounts,
      },
      confidence: {
        average: aggregated.averageConfidence,
        distribution: aggregated.confidenceDistribution,
      },
      unknown_foods: {
        top: aggregated.topUnknownFoods,
        count: aggregated.topUnknownFoods.length,
      },
      alerts: aggregated.alerts,
      discovery_queue: {
        count: discoveryQueue.length,
        candidates: discoveryQueue,
      },
    };

    if (detail) {
      response['raw_sample'] = getRingSnapshot(20);
    }

    if (aggregated.alerts.some((a) => a.severity === 'HIGH')) {
      logger.warn('ontology', 'observability_high_alert',
        `${aggregated.alerts.filter((a) => a.severity === 'HIGH').length} HIGH alert(s) active`,
        { meta: { alerts: aggregated.alerts.filter((a) => a.severity === 'HIGH') } },
      );
    }

    return c.json(response);
  } catch (err) {
    logger.error('ontology', 'observability_error',
      err instanceof Error ? err.message : String(err),
    );
    return c.json({ error: { type: 'SYSTEM_ERROR', message: 'Failed to compute observability summary' } }, 500);
  }
});
