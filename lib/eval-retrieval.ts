import {
  aggregateMetrics,
  computeRankingMetrics,
  type AggregateMetrics,
  type RankingMetrics
} from "@/lib/eval-metrics";
import { rerankCandidates, type RetrievalCandidate } from "@/lib/retrieval";
import { canonicalizeClauseRef, getRulebook } from "@/lib/rulebook";
import { loadRulebookCorpus } from "@/lib/rulebook-corpus-fs";

/**
 * Offline retrieval evaluation.
 *
 * The pipeline's ranking has two stages: a pgvector nearest-neighbour lookup and a
 * lexical + gap-aware rerank. Only the second stage is deterministic and runnable
 * without an embedding provider or a database, so this harness evaluates it directly:
 * every clause in the corpus is offered as a candidate with a neutral vector distance,
 * which reduces `rerankCandidates` to its lexical and boost terms.
 *
 * The numbers are therefore a floor, not the production figure — they say how well the
 * system ranks clauses using no semantic signal at all. That makes them reproducible in
 * CI and meaningful as a regression gate, which the end-to-end number cannot be.
 */

/** Neutral distance so `vectorScore` is 0 for every candidate. */
const NEUTRAL_DISTANCE = 1;

export type GoldenCase = {
  id: string;
  rulebookId: string;
  description: string;
  query: string;
  gapMessages: string[];
  relevant: string[];
};

export type GoldenCaseResult = {
  id: string;
  rulebookId: string;
  description: string;
  relevant: string[];
  ranked: string[];
  metrics: RankingMetrics;
};

export type RetrievalEvalOptions = {
  topK?: number;
  /**
   * When false, gap messages are withheld from the reranker's boost term while
   * remaining in the query text — isolating the contribution of gap-aware routing.
   */
  useGapBoost?: boolean;
};

export type RetrievalEvalResult = {
  topK: number;
  useGapBoost: boolean;
  perCase: GoldenCaseResult[];
  aggregate: AggregateMetrics;
  byRulebook: Array<{ rulebookId: string; aggregate: AggregateMetrics }>;
};

function toCandidates(rulebookId: string): RetrievalCandidate[] {
  return loadRulebookCorpus(rulebookId).map((chunk) => ({
    clauseRef: chunk.clauseRef,
    title: chunk.title,
    text: chunk.text,
    keywords: chunk.keywords,
    distance: NEUTRAL_DISTANCE
  }));
}

export function runRetrievalEval(
  cases: GoldenCase[],
  options: RetrievalEvalOptions = {}
): RetrievalEvalResult {
  const topK = options.topK ?? 5;
  const useGapBoost = options.useGapBoost ?? true;

  const candidateCache = new Map<string, RetrievalCandidate[]>();
  const perCase: GoldenCaseResult[] = [];

  for (const goldenCase of cases) {
    const rulebook = getRulebook(goldenCase.rulebookId);
    if (!candidateCache.has(rulebook.id)) {
      candidateCache.set(rulebook.id, toCandidates(rulebook.id));
    }
    const candidates = candidateCache.get(rulebook.id) ?? [];

    // Production appends open-gap messages to the retrieval query, so the query text
    // includes them in both arms of the ablation; only the boost term varies.
    const queryText = [goldenCase.query, ...goldenCase.gapMessages].join("\n");

    const ranked = rerankCandidates({
      candidates,
      queryText,
      gapMessages: useGapBoost ? goldenCase.gapMessages : [],
      rulebook,
      topK: candidates.length
    });

    const rankedRefs = ranked.map((clause) => canonicalizeClauseRef(rulebook, clause.clauseRef));
    const relevantRefs = goldenCase.relevant.map((ref) => canonicalizeClauseRef(rulebook, ref));

    perCase.push({
      id: goldenCase.id,
      rulebookId: goldenCase.rulebookId,
      description: goldenCase.description,
      relevant: relevantRefs,
      ranked: rankedRefs.slice(0, topK),
      metrics: computeRankingMetrics(rankedRefs, relevantRefs, topK)
    });
  }

  const rulebookIds = [...new Set(cases.map((c) => c.rulebookId))];

  return {
    topK,
    useGapBoost,
    perCase,
    aggregate: aggregateMetrics(perCase.map((c) => c.metrics)),
    byRulebook: rulebookIds.map((rulebookId) => ({
      rulebookId,
      aggregate: aggregateMetrics(
        perCase.filter((c) => c.rulebookId === rulebookId).map((c) => c.metrics)
      )
    }))
  };
}

export type GapBoostAblation = {
  withBoost: RetrievalEvalResult;
  withoutBoost: RetrievalEvalResult;
  delta: {
    meanRecall: number;
    mrr: number;
    hitRateAtOne: number;
  };
};

/** Measures what gap-aware clause routing actually contributes to ranking quality. */
export function runGapBoostAblation(
  cases: GoldenCase[],
  topK = 5
): GapBoostAblation {
  const withBoost = runRetrievalEval(cases, { topK, useGapBoost: true });
  const withoutBoost = runRetrievalEval(cases, { topK, useGapBoost: false });

  return {
    withBoost,
    withoutBoost,
    delta: {
      meanRecall: withBoost.aggregate.meanRecall - withoutBoost.aggregate.meanRecall,
      mrr: withBoost.aggregate.mrr - withoutBoost.aggregate.mrr,
      hitRateAtOne: withBoost.aggregate.hitRateAtOne - withoutBoost.aggregate.hitRateAtOne
    }
  };
}
