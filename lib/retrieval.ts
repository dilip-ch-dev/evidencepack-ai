import { prisma } from "@/lib/prisma";
import {
  getActiveRulebook,
  preferredClauseRefsForGaps,
  type Rulebook
} from "@/lib/rulebook";

/**
 * The `RegulationChunk.articleRef` column predates the rulebook abstraction and is
 * aliased to `clauseRef` here so the domain vocabulary stays rulebook-neutral without
 * migrating a table that already holds ingested corpora.
 */
export type RetrievedClause = {
  clauseRef: string;
  title: string;
  text: string;
  distance: number;
  corpusVersion?: string;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
  preferredBoost: number;
};

type RawClause = {
  clauseRef: string;
  title: string;
  text: string;
  distance: number;
  corpusVersion?: string | null;
  keywords?: string | null;
};

const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;
const PREFERRED_BOOST = 0.08;

export const RETRIEVAL_WEIGHTS = {
  vector: VECTOR_WEIGHT,
  keyword: KEYWORD_WEIGHT,
  preferredBoost: PREFERRED_BOOST
} as const;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function keywordScore(queryTokens: string[], clause: RawClause): number {
  if (queryTokens.length === 0) {
    return 0;
  }
  const haystack = `${clause.clauseRef} ${clause.title} ${clause.text} ${clause.keywords ?? ""}`.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      hits += 1;
    }
  }
  return hits / queryTokens.length;
}

async function vectorCandidates(
  queryEmbedding: number[],
  corpusVersion: string,
  candidateLimit: number
): Promise<RawClause[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  try {
    const versioned = await prisma.$queryRawUnsafe<RawClause[]>(
      `SELECT "articleRef" AS "clauseRef", title, text, "corpusVersion", keywords,
              embedding <=> $1::vector AS distance
       FROM "RegulationChunk"
       WHERE embedding IS NOT NULL
         AND ("corpusVersion" = $2 OR "corpusVersion" IS NULL)
       ORDER BY embedding <=> $1::vector
       LIMIT $3;`,
      vectorLiteral,
      corpusVersion,
      candidateLimit
    );
    if (versioned.length > 0) {
      return versioned;
    }
  } catch {
    // Older schema without corpusVersion/keywords — fall through.
  }

  return prisma.$queryRawUnsafe<RawClause[]>(
    `SELECT "articleRef" AS "clauseRef", title, text,
            embedding <=> $1::vector AS distance
     FROM "RegulationChunk"
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2;`,
    vectorLiteral,
    candidateLimit
  );
}

/**
 * Rerank vector candidates with keyword overlap and a gap-aware clause boost.
 * Extracted from the DB call so it can be evaluated on a fixed candidate set
 * without an embedding provider (see `scripts/eval-retrieval.ts`).
 */
export function rerankCandidates(args: {
  candidates: RawClause[];
  queryText: string;
  gapMessages?: string[];
  rulebook?: Rulebook;
  topK?: number;
}): RetrievedClause[] {
  const rulebook = args.rulebook ?? getActiveRulebook();
  const topK = args.topK ?? 5;
  const queryTokens = tokenize(args.queryText);
  const preferred = new Set(preferredClauseRefsForGaps(rulebook, args.gapMessages ?? []));

  return args.candidates
    .filter((row) => Number.isFinite(Number(row.distance)))
    .map((row) => {
      const vectorScore = Math.max(0, 1 - Number(row.distance));
      const kw = keywordScore(queryTokens, row);
      const preferredBoost = preferred.has(row.clauseRef) ? PREFERRED_BOOST : 0;
      const hybridScore = vectorScore * VECTOR_WEIGHT + kw * KEYWORD_WEIGHT + preferredBoost;
      return {
        clauseRef: row.clauseRef,
        title: row.title,
        text: row.text,
        distance: Number(row.distance),
        corpusVersion: row.corpusVersion ?? undefined,
        vectorScore,
        keywordScore: kw,
        hybridScore,
        preferredBoost
      } satisfies RetrievedClause;
    })
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, topK);
}

/**
 * Hybrid retrieval: vector top-N from pgvector, then rerank with keyword overlap +
 * gap-aware preferred-clause boost. Returns topK clauses.
 */
export async function retrieveRelevantClausesHybrid(args: {
  queryEmbedding: number[];
  queryText: string;
  gapMessages?: string[];
  corpusVersion?: string;
  candidateLimit?: number;
  topK?: number;
  rulebook?: Rulebook;
}): Promise<RetrievedClause[]> {
  const rulebook = args.rulebook ?? getActiveRulebook();
  const corpusVersion = args.corpusVersion ?? rulebook.id;
  const candidateLimit = args.candidateLimit ?? 12;

  const candidates = await vectorCandidates(
    args.queryEmbedding,
    corpusVersion,
    candidateLimit
  );

  return rerankCandidates({
    candidates,
    queryText: args.queryText,
    gapMessages: args.gapMessages,
    rulebook,
    topK: args.topK
  });
}

export type { RawClause as RetrievalCandidate };
