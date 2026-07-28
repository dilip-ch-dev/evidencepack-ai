import { preferredArticlesForGaps, CURRENT_CORPUS_VERSION } from "@/lib/obligations";
import { prisma } from "@/lib/prisma";

export type RetrievedClause = {
  articleRef: string;
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
  articleRef: string;
  title: string;
  text: string;
  distance: number;
  corpusVersion?: string | null;
  keywords?: string | null;
};

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
  const haystack = `${clause.articleRef} ${clause.title} ${clause.text} ${clause.keywords ?? ""}`.toLowerCase();
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
      `SELECT "articleRef", title, text, "corpusVersion", keywords,
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
    `SELECT "articleRef", title, text,
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
 * Hybrid retrieval: vector top-N, then rerank with keyword overlap +
 * gap-aware preferred-article boost. Returns topK clauses.
 */
export async function retrieveRelevantClausesHybrid(args: {
  queryEmbedding: number[];
  queryText: string;
  gapMessages?: string[];
  corpusVersion?: string;
  candidateLimit?: number;
  topK?: number;
}): Promise<RetrievedClause[]> {
  const corpusVersion = args.corpusVersion ?? CURRENT_CORPUS_VERSION;
  const candidateLimit = args.candidateLimit ?? 12;
  const topK = args.topK ?? 5;

  const candidates = await vectorCandidates(
    args.queryEmbedding,
    corpusVersion,
    candidateLimit
  );

  const queryTokens = tokenize(args.queryText);
  const preferred = new Set(preferredArticlesForGaps(args.gapMessages ?? []));

  return candidates
    .filter((row) => Number.isFinite(row.distance))
    .map((row) => {
      const vectorScore = Math.max(0, 1 - Number(row.distance));
      const kw = keywordScore(queryTokens, row);
      const preferredBoost = preferred.has(row.articleRef) ? 0.08 : 0;
      const hybridScore = vectorScore * 0.7 + kw * 0.3 + preferredBoost;
      return {
        articleRef: row.articleRef,
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
