import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseClauseMarkdown, type ClauseChunk } from "@/lib/rulebook-corpus";
import type { Rulebook } from "@/lib/rulebook";

/**
 * Filesystem access to rulebook clause corpora. Script- and test-only: importing this
 * from a component would pull `node:fs` into the Next bundle. Runtime clause text
 * comes from pgvector, not from disk.
 */

export function corpusPath(rulebookId: string): string {
  return resolve(process.cwd(), "rulebooks", rulebookId, "clauses.md");
}

export function loadRulebookCorpus(rulebook: Rulebook | string): ClauseChunk[] {
  const id = typeof rulebook === "string" ? rulebook : rulebook.id;
  return parseClauseMarkdown(readFileSync(corpusPath(id), "utf8"));
}
