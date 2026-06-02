import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_FILE = resolve(process.cwd(), "data/eu-ai-act-key-provisions.md");
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

type RegulationChunkInput = {
  articleRef: string;
  title: string;
  text: string;
};

function parseChunks(markdown: string): RegulationChunkInput[] {
  // One chunk per "## " article section.
  return markdown
    .split(/\n(?=## )/)
    .map((section) => section.trim())
    .filter((section) => section.startsWith("## "))
    .map((section) => {
      const lines = section.split("\n");
      const heading = lines[0].replace(/^##\s*/, "").trim();
      const body = lines.slice(1).join("\n").trim();

      // Heading format: "Art 9 — Risk management system"
      const [articleRefPart, ...titleParts] = heading.split(/\s+[—-]\s+/);
      const articleRef = articleRefPart.trim();
      const title = titleParts.join(" — ").trim() || heading;

      return { articleRef, title, text: body };
    })
    .filter((chunk) => chunk.text.length > 0);
}

async function embed(ai: GoogleGenAI, text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: OUTPUT_DIMENSIONALITY }
  });

  // Confirmed field path via probe: response.embeddings[0].values (768 floats).
  const values = response.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length !== OUTPUT_DIMENSIONALITY) {
    throw new Error(
      `Unexpected embedding shape: expected ${OUTPUT_DIMENSIONALITY} floats, got ${values?.length ?? "none"}.`
    );
  }
  return values;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const markdown = readFileSync(SOURCE_FILE, "utf8");
  const chunks = parseChunks(markdown);

  if (chunks.length === 0) {
    throw new Error(`No article sections found in ${SOURCE_FILE}.`);
  }

  console.log(`Parsed ${chunks.length} regulation chunks from ${SOURCE_FILE}.`);

  // Idempotent re-ingest: clear previous rows for this source set.
  await prisma.$executeRawUnsafe('DELETE FROM "RegulationChunk";');

  let inserted = 0;
  for (const chunk of chunks) {
    const embedInput = `${chunk.articleRef} — ${chunk.title}\n${chunk.text}`;
    const values = await embed(ai, embedInput);
    const vectorLiteral = `[${values.join(",")}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "RegulationChunk" (id, "articleRef", title, text, embedding, "createdAt")
       VALUES ($1, $2, $3, $4, $5::vector, NOW());`,
      randomUUID(),
      chunk.articleRef,
      chunk.title,
      chunk.text,
      vectorLiteral
    );

    inserted += 1;
    console.log(`Inserted ${chunk.articleRef} — ${chunk.title}`);
  }

  console.log(`Done. Inserted ${inserted} regulation chunks with ${OUTPUT_DIMENSIONALITY}-dim embeddings.`);
}

main()
  .catch((error) => {
    console.error("Regulation ingestion failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
