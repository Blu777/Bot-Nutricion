// ─── Auto-Discovery Queue ─────────────────────────────────────
// Groups unknown foods by semantic similarity, orders by frequency,
// and suggests new FoodConcept IDs or aliases for the ontology.
//
// Grouping strategy:
//   1. Exact normalizedInput match → same group
//   2. One string contains the other (min 4 chars, ratio >= 0.5) → same group
//   3. Levenshtein distance <= 2 → same group
// Groups are ordered by total frequency descending.

import { getTopUnknownFoods } from './collector.js';
import type { DiscoveryCandidate } from './types.js';

// ── Levenshtein (bounded) ─────────────────────────────────────
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

// ── Similarity check ──────────────────────────────────────────
function areSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 4) {
    if (a.includes(b) && b.length / a.length >= 0.5) return true;
    if (b.includes(a) && a.length / b.length >= 0.5) return true;
  }
  return levenshtein(a, b) <= 2;
}

// ── Slugify for concept ID suggestion ────────────────────────
function toConceptId(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40);
}

// ── Main: build discovery queue ───────────────────────────────
export function buildDiscoveryQueue(limit = 30): DiscoveryCandidate[] {
  const unknowns = getTopUnknownFoods(200);
  if (unknowns.length === 0) return [];

  // Union-Find style grouping
  const groups: Array<{
    members: Array<{ input: string; normalizedInput: string; frequency: number }>;
    totalFrequency: number;
  }> = [];

  for (const item of unknowns) {
    let placed = false;
    for (const group of groups) {
      const representative = group.members[0];
      if (areSimilar(item.normalizedInput, representative.normalizedInput)) {
        group.members.push(item);
        group.totalFrequency += item.frequency;
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({ members: [item], totalFrequency: item.frequency });
    }
  }

  // Sort groups by frequency descending
  groups.sort((a, b) => b.totalFrequency - a.totalFrequency);

  return groups.slice(0, limit).map((group): DiscoveryCandidate => {
    // Pick the most frequent member as representative
    const sorted = [...group.members].sort((a, b) => b.frequency - a.frequency);
    const representative = sorted[0];

    // Collect all unique variants
    const variants = [...new Set(sorted.map((m) => m.input))];

    // Suggest a concept ID from the representative
    const suggestedConceptId = toConceptId(representative.normalizedInput);

    // All normalized inputs become alias suggestions
    const suggestedAliases = [...new Set(sorted.map((m) => m.normalizedInput))];

    return {
      representativeInput: representative.input,
      variants,
      frequency: group.totalFrequency,
      suggestedConceptId,
      suggestedAliases,
    };
  });
}
