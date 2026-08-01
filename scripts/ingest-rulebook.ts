import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import { parseClauseMarkdown, validateCorpus } from "@/lib/rulebook-corpus";
import { DEFAULT_RULEBOOK_ID, getRulebook, listRulebookIds } from "@/lib/rulebook";

/**
 * Ingests one rulebook's clause corpus into pgvector, tagged with the rulebook id as
 * `corpusVersion`. Only that rulebook's rows are replaced, so multiple rulebooks can
 * coexist in the same table and retrieval stays scoped by version.
 *
 *   npm run ingest -- owasp-llm-top10-v1
 *   RULEBOOK_ID=owasp-llm-top10-v1 npm run ingest
 */

const prisma = new PrismaClient();

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

function resolveRulebookId(): string {
  const fromArg = process.argv[2]?.trim();
  const fromEnv = process.env.RULEBOOK_ID?.trim();
  return fromArg || fromEnv || DEFAULT_RULEBOOK_ID;
}

async function embed(ai: GoogleGenAI, text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: OUTPUT_DIMENSIONALITY }
  });

  const values = response.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length !== OUTPUT_DIMENSIONALITY) {
    throw new Error(
      `Unexpected embedding shape: expected ${OUTPUT_DIMENSIONALITY} floats, got ${values?.length ?? "none"}.`
    );
  }
  return values;
}

async function main() {
  const rulebookId = resolveRulebookId();
  const rulebook = getRulebook(rulebookId);

  const sourceFile = resolve(process.cwd(), "rulebooks", rulebook.id, "clauses.md");
  const chunks = parseClauseMarkdown(readFileSync(sourceFile, "utf8"));

  if (chunks.length === 0) {
    throw new Error(`No clause sections found in ${sourceFile}.`);
  }

  const validation = validateCorpus(rulebook, chunks);
  if (validation.unscoredClauses.length > 0) {
    console.log(
      `Note: ${validation.unscoredClauses.length} clause(s) are citable but not scored: ${validation.unscoredClauses.join(", ")}.`
    );
  }
  if (!validation.ok) {
    throw new Error(
      [
        `Corpus validation failed for "${rulebook.id}".`,
        validation.uncitableObligations.length > 0
          ? `Scored obligations with no clause text: ${validation.uncitableObligations.join(", ")}.`
          : "",
        validation.duplicateRefs.length > 0
          ? `Duplicate clause refs: ${validation.duplicateRefs.join(", ")}.`
          : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  const ai = new GoogleGenAI({ apiKey });

  console.log(
    `Ingesting ${chunks.length} clauses for "${rulebook.name}" (corpusVersion=${rulebook.id}).`
  );

  // Versioned re-ingest: replace only this rulebook's rows, plus any legacy
  // untagged rows from before corpus versioning existed.
  await prisma.$executeRawUnsafe(
    `DELETE FROM "RegulationChunk" WHERE "corpusVersion" = $1 OR "corpusVersion" IS NULL;`,
    rulebook.id
  );

  let inserted = 0;
  for (const chunk of chunks) {
    const embedInput = `${chunk.clauseRef} — ${chunk.title}\n${chunk.text}\nKeywords: ${chunk.keywords ?? ""}`;
    const values = await embed(ai, embedInput);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "RegulationChunk"
        (id, "articleRef", title, text, embedding, "corpusVersion", keywords, "createdAt")
       VALUES ($1, $2, $3, $4, $5::vector, $6, $7, NOW());`,
      randomUUID(),
      chunk.clauseRef,
      chunk.title,
      chunk.text,
      `[${values.join(",")}]`,
      rulebook.id,
      chunk.keywords
    );

    inserted += 1;
    console.log(`Inserted ${chunk.clauseRef} — ${chunk.title}`);
  }

  console.log(
    `Done. Inserted ${inserted} clauses for corpusVersion=${rulebook.id} (${OUTPUT_DIMENSIONALITY}-dim).`
  );
  console.log(`Available rulebooks: ${listRulebookIds().join(", ")}.`);
}

main()
  .catch((error) => {
    console.error("Rulebook ingestion failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
