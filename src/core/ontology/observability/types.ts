// ─── Ontology Observability Types ────────────────────────────

export type ResolutionPath =
  | 'EXACT_MATCH'
  | 'CONCEPT_MATCH'
  | 'CONCEPT_PLUS_PREPARATION'
  | 'FALLBACK_CATEGORY'
  | 'FAILED';

export type NutritionSource = 'USDA' | 'INTA' | 'FALLBACK' | 'COMPUTED';

export interface NutritionResolutionMetric {
  input: string;
  resolutionPath: ResolutionPath;
  foodConcept?: string;
  preparation?: string;
  confidence: number;
  finalMacros: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  source: NutritionSource;
  guardrailWarnings: string[];
  timestamp: number;
}

export interface UnknownFoodEntry {
  input: string;
  normalizedInput: string;
  frequency: number;
  lastSeen: number;
}

export interface DiscoveryCandidate {
  representativeInput: string;
  variants: string[];
  frequency: number;
  suggestedConceptId: string;
  suggestedAliases: string[];
}

export type AlertSeverity = 'HIGH' | 'MEDIUM';

export interface ObservabilityAlert {
  severity: AlertSeverity;
  code: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface AggregatedMetrics {
  totalResolutions: number;
  exactMatchRate: number;
  conceptMatchRate: number;
  conceptPlusPrepRate: number;
  fallbackRate: number;
  unknownFoodRate: number;
  averageConfidence: number;
  ontologyCoveragePercent: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  pathCounts: Record<ResolutionPath, number>;
  topUnknownFoods: UnknownFoodEntry[];
  alerts: ObservabilityAlert[];
  windowSeconds: number;
  sampledAt: number;
}
