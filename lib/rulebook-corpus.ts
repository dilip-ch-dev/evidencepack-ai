import {
  canonicalizeClauseRef,
  type Rulebook
} from "@/lib/rulebook";

/**
 * Parsing and validation for a rulebook's `clauses.md` corpus. Kept free of `fs`
 * so both the ingestion script and the validation test exercise the same code.
 */

export type ClauseChunk = {
  clauseRef: string;
  title: string;
  text: string;
  keywords: string | null;
};

/**
 * Parses clause sections of the form:
 *
 *   ## <clauseRef> — <title>
 *   <body...>
 *   Keywords: a, b, c
 *
 * The heading separator must be an em dash, en dash, or spaced hyphen, so refs
 * containing a bare hyphen are not split.
 */
export function parseClauseMarkdown(markdown: string): ClauseChunk[] {
  return markdown
    .split(/\n(?=## )/)
    .map((section) => section.trim())
    .filter((section) => section.startsWith("## "))
    .map((section) => {
      const lines = section.split("\n");
      const heading = lines[0].replace(/^##\s*/, "").trim();
      const bodyLines = lines.slice(1);
      const keywordLine = bodyLines.find((line) => /^keywords:/i.test(line.trim()));
      const keywords = keywordLine ? keywordLine.replace(/^keywords:\s*/i, "").trim() : null;
      const text = bodyLines
        .filter((line) => !/^keywords:/i.test(line.trim()))
        .join("\n")
        .trim();

      const [refPart, ...titleParts] = heading.split(/\s+[—–]\s+|\s+-\s+/);
      const clauseRef = refPart.trim();
      const title = titleParts.join(" — ").trim() || heading;

      return { clauseRef, title, text, keywords };
    })
    .filter((chunk) => chunk.clauseRef.length > 0 && chunk.text.length > 0);
}

export type CorpusValidation = {
  ok: boolean;
  clauseCount: number;
  /** Obligations that are scored but have no clause text, so they can never be cited. */
  uncitableObligations: string[];
  /** Clauses present in the corpus but not scored — allowed, reported for awareness. */
  unscoredClauses: string[];
  duplicateRefs: string[];
  emptyKeywords: string[];
};

/**
 * Cross-checks a parsed corpus against its manifest. The important failure is an
 * obligation with no corresponding clause: scoring would penalise the system for it
 * while retrieval could never surface it, so no recommendation could ever cite it.
 */
export function validateCorpus(rulebook: Rulebook, chunks: ClauseChunk[]): CorpusValidation {
  const canonical = (value: string) => canonicalizeClauseRef(rulebook, value);

  const corpusRefs = new Map<string, number>();
  for (const chunk of chunks) {
    const key = canonical(chunk.clauseRef);
    corpusRefs.set(key, (corpusRefs.get(key) ?? 0) + 1);
  }

  const obligationRefs = new Set(rulebook.obligations.map((o) => canonical(o.clauseRef)));

  const uncitableObligations = rulebook.obligations
    .filter((o) => !corpusRefs.has(canonical(o.clauseRef)))
    .map((o) => o.clauseRef);

  const unscoredClauses = chunks
    .filter((chunk) => !obligationRefs.has(canonical(chunk.clauseRef)))
    .map((chunk) => chunk.clauseRef);

  const duplicateRefs = [...corpusRefs.entries()]
    .filter(([, count]) => count > 1)
    .map(([ref]) => ref);

  const emptyKeywords = chunks
    .filter((chunk) => !chunk.keywords || chunk.keywords.length === 0)
    .map((chunk) => chunk.clauseRef);

  return {
    ok: uncitableObligations.length === 0 && duplicateRefs.length === 0,
    clauseCount: chunks.length,
    uncitableObligations,
    unscoredClauses,
    duplicateRefs,
    emptyKeywords
  };
}
