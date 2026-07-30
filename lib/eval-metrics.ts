/**
 * Ranking metrics for retrieval evaluation. Pure functions over canonicalized
 * ref lists so they can be unit-tested independently of the retrieval pipeline.
 *
 * All functions treat `relevant` as a set: duplicates in `ranked` are counted once.
 */

export type RankingMetrics = {
  /** Fraction of relevant clauses that appear in the top-k. */
  recall: number;
  /** Fraction of the top-k that are relevant. */
  precision: number;
  /** 1/rank of the first relevant clause, 0 if none appear. */
  reciprocalRank: number;
  /** 1 if the top-ranked clause is relevant. */
  hitAtOne: number;
  /** Rank (1-based) of the first relevant clause, null if none appear. */
  firstRelevantRank: number | null;
};

export function computeRankingMetrics(
  ranked: string[],
  relevant: string[],
  k: number
): RankingMetrics {
  const relevantSet = new Set(relevant);
  const topK = ranked.slice(0, k);

  const foundInTopK = new Set(topK.filter((ref) => relevantSet.has(ref)));
  const recall = relevantSet.size === 0 ? 1 : foundInTopK.size / relevantSet.size;
  const precision = topK.length === 0 ? 0 : foundInTopK.size / topK.length;

  // Reciprocal rank is measured over the full ranking, not just the top-k, so a
  // near-miss at rank 6 is distinguishable from a clause that never ranks at all.
  const firstIndex = ranked.findIndex((ref) => relevantSet.has(ref));
  const firstRelevantRank = firstIndex === -1 ? null : firstIndex + 1;
  const reciprocalRank = firstRelevantRank === null ? 0 : 1 / firstRelevantRank;
  const hitAtOne = ranked.length > 0 && relevantSet.has(ranked[0]) ? 1 : 0;

  return { recall, precision, reciprocalRank, hitAtOne, firstRelevantRank };
}

export type AggregateMetrics = {
  cases: number;
  meanRecall: number;
  meanPrecision: number;
  mrr: number;
  hitRateAtOne: number;
};

export function aggregateMetrics(all: RankingMetrics[]): AggregateMetrics {
  if (all.length === 0) {
    return { cases: 0, meanRecall: 0, meanPrecision: 0, mrr: 0, hitRateAtOne: 0 };
  }
  const mean = (pick: (m: RankingMetrics) => number) =>
    all.reduce((sum, m) => sum + pick(m), 0) / all.length;

  return {
    cases: all.length,
    meanRecall: mean((m) => m.recall),
    meanPrecision: mean((m) => m.precision),
    mrr: mean((m) => m.reciprocalRank),
    hitRateAtOne: mean((m) => m.hitAtOne)
  };
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRatio(value: number, digits = 3): string {
  return value.toFixed(digits);
}
