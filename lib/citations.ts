import {
  canonicalizeClauseRef,
  getActiveRulebook,
  normalizeClauseRefBase,
  type Rulebook
} from "@/lib/rulebook";

export type RecommendationWithCitation = {
  text: string;
  clauseRef: string;
};

export type RetrievedClauseRef = {
  clauseRef: string;
};

export type CitationFilterResult = {
  kept: RecommendationWithCitation[];
  /** Ungrounded recommendations, each with the ref that failed to resolve. */
  dropped: Array<RecommendationWithCitation & { normalizedRef: string }>;
  allowedRefs: string[];
};

/**
 * Normalize a clause reference for comparison, folding rulebook-declared aliases
 * into their canonical ref. "Article 14" and "Art. 14" both become "art 14";
 * "Art 11" becomes "art 11 + annex iv" because the EU rulebook declares it an alias.
 *
 * Alias folding matters for recall: a model citing the shorter form of a compound
 * reference is misnaming a real clause, not inventing one, and dropping it would
 * hide a correct finding.
 */
export function normalizeClauseRef(value: string, rulebook: Rulebook = getActiveRulebook()): string {
  return canonicalizeClauseRef(rulebook, value);
}

export function buildAllowedClauseRefSet(
  clauses: RetrievedClauseRef[],
  rulebook: Rulebook = getActiveRulebook()
): Set<string> {
  return new Set(
    clauses
      .map((clause) => normalizeClauseRef(clause.clauseRef, rulebook))
      .filter((ref) => ref.length > 0)
  );
}

/**
 * Fail-closed citation gate: keep only recommendations whose clauseRef matches a
 * clause that was actually retrieved. Anything else is dropped rather than repaired,
 * so an ungrounded claim can never reach the export.
 */
export function filterGroundedRecommendations(
  recommendations: RecommendationWithCitation[],
  retrievedClauses: RetrievedClauseRef[],
  rulebook: Rulebook = getActiveRulebook()
): CitationFilterResult {
  const allowed = buildAllowedClauseRefSet(retrievedClauses, rulebook);
  const kept: RecommendationWithCitation[] = [];
  const dropped: Array<RecommendationWithCitation & { normalizedRef: string }> = [];

  for (const recommendation of recommendations) {
    const normalizedRef = normalizeClauseRef(recommendation.clauseRef, rulebook);
    if (allowed.has(normalizedRef)) {
      kept.push(recommendation);
    } else {
      dropped.push({ ...recommendation, normalizedRef });
    }
  }

  return {
    kept,
    dropped,
    allowedRefs: [...allowed]
  };
}

export { normalizeClauseRefBase };
