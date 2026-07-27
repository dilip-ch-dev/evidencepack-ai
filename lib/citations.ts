export type RecommendationWithCitation = {
  text: string;
  articleRef: string;
};

export type RetrievedArticle = {
  articleRef: string;
};

export type CitationFilterResult = {
  kept: RecommendationWithCitation[];
  dropped: RecommendationWithCitation[];
  allowedRefs: string[];
};

/**
 * Normalize article references for comparison.
 * "Art 14", "Art. 14", "Article 14", "art 14 — Human oversight" → "art 14"
 */
export function normalizeArticleRef(value: string): string {
  return value
    .toLowerCase()
    .replace(/^article\b/i, "art")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*[—–-].*$/, "")
    .trim();
}

export function buildAllowedArticleRefSet(clauses: RetrievedArticle[]): Set<string> {
  return new Set(
    clauses
      .map((clause) => normalizeArticleRef(clause.articleRef))
      .filter((ref) => ref.length > 0)
  );
}

/**
 * Fail-closed citation gate: keep only recommendations whose articleRef
 * matches a retrieved clause. Borrowed from the agent-platform groundedness rule.
 */
export function filterGroundedRecommendations(
  recommendations: RecommendationWithCitation[],
  retrievedClauses: RetrievedArticle[]
): CitationFilterResult {
  const allowed = buildAllowedArticleRefSet(retrievedClauses);
  const kept: RecommendationWithCitation[] = [];
  const dropped: RecommendationWithCitation[] = [];

  for (const recommendation of recommendations) {
    const normalized = normalizeArticleRef(recommendation.articleRef);
    if (allowed.has(normalized)) {
      kept.push(recommendation);
    } else {
      dropped.push(recommendation);
    }
  }

  return {
    kept,
    dropped,
    allowedRefs: [...allowed]
  };
}
