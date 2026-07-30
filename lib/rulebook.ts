import { z } from "zod";

import euAiActV2 from "@/rulebooks/eu-ai-act-v2/rulebook.json";
import llmProdReadinessV1 from "@/rulebooks/llm-prod-readiness-v1/rulebook.json";
import owaspLlmTop10V1 from "@/rulebooks/owasp-llm-top10-v1/rulebook.json";

/**
 * A rulebook is the only domain-specific part of this pipeline. Everything else
 * (retrieval, the citation gate, scoring, telemetry) is driven by the manifest,
 * so swapping "EU AI Act" for "OWASP LLM Top 10" is a data change, not a code change.
 *
 * Manifests are imported statically rather than discovered from disk so they are
 * type-checked, bundled by Next without filesystem tracing, and usable from both
 * server components and standalone scripts. Clause *text* lives alongside each
 * manifest in `clauses.md` and is only read by the ingestion script.
 */

/**
 * Obligations are grouped into two readiness axes. `documentation` covers
 * "can you show what the system is", `control` covers "can you show it is governed".
 * Each rulebook supplies its own labels for the two axes.
 */
export const CLAUSE_FAMILIES = ["documentation", "control"] as const;
export type ClauseFamily = (typeof CLAUSE_FAMILIES)[number];

const obligationSchema = z.object({
  clauseRef: z.string().min(1),
  title: z.string().min(1),
  /** Questionnaire section keys whose answers/evidence satisfy this obligation. */
  sectionKeys: z.array(z.string().min(1)).min(1),
  weight: z.number().positive(),
  family: z.enum(CLAUSE_FAMILIES),
  /**
   * Alternate spellings a model may emit for this clause. Citing "Art 11" when the
   * canonical ref is "Art 11 + Annex IV" is a naming miss, not a hallucination, so
   * aliases are folded into the canonical ref before the citation gate runs.
   */
  aliases: z.array(z.string().min(1)).default([])
});

const gapRoutingSchema = z.object({
  /** Case-insensitive regex matched against concatenated open-gap messages. */
  pattern: z.string().min(1),
  clauseRefs: z.array(z.string().min(1)).min(1)
});

const manifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  jurisdiction: z.string().min(1),
  sourceNote: z.string().min(1),
  /** How to describe one unit of this rulebook in the UI ("article", "risk", "check"). */
  clauseLabel: z.object({
    singular: z.string().min(1),
    plural: z.string().min(1)
  }),
  familyLabels: z.object({
    documentation: z.string().min(1),
    control: z.string().min(1)
  }),
  /**
   * Long-form ref prefixes normalized to their short form, e.g. ["article", "art"].
   * Applied longest-first so "article" wins over a hypothetical "art".
   */
  refPrefixAliases: z.array(z.tuple([z.string().min(1), z.string().min(1)])).default([]),
  obligations: z.array(obligationSchema).min(1),
  gapRouting: z.array(gapRoutingSchema).default([])
});

export type ObligationDef = z.infer<typeof obligationSchema>;
export type GapRoutingRule = z.infer<typeof gapRoutingSchema>;
export type RulebookManifest = z.infer<typeof manifestSchema>;

export type Rulebook = RulebookManifest & {
  /** Normalized alias → normalized canonical ref, precomputed at load. */
  refAliasMap: ReadonlyMap<string, string>;
  compiledGapRouting: ReadonlyArray<{ matcher: RegExp; clauseRefs: string[] }>;
};

const RAW_MANIFESTS: unknown[] = [euAiActV2, owaspLlmTop10V1, llmProdReadinessV1];

/**
 * Generic ref normalizer, applied identically to model output and to corpus refs.
 * Only strips a trailing title after an em/en dash or a spaced hyphen, so refs that
 * legitimately contain a hyphen ("LLM01-Prompt Injection", "PR-03") survive intact.
 */
export function normalizeClauseRefBase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*[—–]\s*.*$/, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function applyPrefixAliases(value: string, aliases: ReadonlyArray<readonly [string, string]>): string {
  for (const [long, short] of aliases) {
    const pattern = new RegExp(`^${escapeRegExp(long.toLowerCase())}\\b`);
    if (pattern.test(value)) {
      return value.replace(pattern, short.toLowerCase()).replace(/\s+/g, " ").trim();
    }
  }
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRulebook(manifest: RulebookManifest): Rulebook {
  // Longest prefix first so "article" is not shadowed by a shorter overlapping alias.
  const prefixAliases = [...manifest.refPrefixAliases].sort((a, b) => b[0].length - a[0].length);

  const normalize = (value: string) =>
    applyPrefixAliases(normalizeClauseRefBase(value), prefixAliases);

  const canonicalRefs = new Set(manifest.obligations.map((o) => normalize(o.clauseRef)));
  const refAliasMap = new Map<string, string>();

  for (const obligation of manifest.obligations) {
    const canonical = normalize(obligation.clauseRef);
    for (const alias of obligation.aliases) {
      const normalizedAlias = normalize(alias);
      if (canonicalRefs.has(normalizedAlias) && normalizedAlias !== canonical) {
        throw new Error(
          `Rulebook "${manifest.id}": alias "${alias}" on ${obligation.clauseRef} collides with another obligation's canonical ref.`
        );
      }
      const existing = refAliasMap.get(normalizedAlias);
      if (existing && existing !== canonical) {
        throw new Error(
          `Rulebook "${manifest.id}": alias "${alias}" is claimed by both "${existing}" and "${canonical}".`
        );
      }
      refAliasMap.set(normalizedAlias, canonical);
    }
  }

  const compiledGapRouting = manifest.gapRouting.map((rule) => ({
    matcher: new RegExp(rule.pattern, "i"),
    clauseRefs: rule.clauseRefs
  }));

  return { ...manifest, refAliasMap, compiledGapRouting };
}

const REGISTRY: ReadonlyMap<string, Rulebook> = (() => {
  const map = new Map<string, Rulebook>();
  for (const raw of RAW_MANIFESTS) {
    const parsed = manifestSchema.safeParse(raw);
    if (!parsed.success) {
      const id =
        raw && typeof raw === "object" && "id" in raw ? String((raw as { id: unknown }).id) : "unknown";
      throw new Error(`Invalid rulebook manifest "${id}": ${parsed.error.message}`);
    }
    if (map.has(parsed.data.id)) {
      throw new Error(`Duplicate rulebook id "${parsed.data.id}".`);
    }
    map.set(parsed.data.id, buildRulebook(parsed.data));
  }
  return map;
})();

export const DEFAULT_RULEBOOK_ID = "eu-ai-act-v2";

export function listRulebooks(): Rulebook[] {
  return [...REGISTRY.values()];
}

export function listRulebookIds(): string[] {
  return [...REGISTRY.keys()];
}

export function getRulebook(id: string): Rulebook {
  const rulebook = REGISTRY.get(id);
  if (!rulebook) {
    throw new Error(
      `Unknown rulebook "${id}". Available: ${[...REGISTRY.keys()].join(", ")}.`
    );
  }
  return rulebook;
}

export function findRulebook(id: string): Rulebook | undefined {
  return REGISTRY.get(id);
}

/**
 * The rulebook the app assesses against. `RULEBOOK_ID` selects it at deploy time;
 * a corpus for that id must have been ingested first.
 */
export function getActiveRulebook(): Rulebook {
  const configured = process.env.RULEBOOK_ID?.trim();
  if (!configured) {
    return getRulebook(DEFAULT_RULEBOOK_ID);
  }
  return getRulebook(configured);
}

/**
 * Fold a raw ref into the canonical ref for this rulebook. Unknown refs are
 * returned normalized but unmapped, so the citation gate can still reject them.
 */
export function canonicalizeClauseRef(rulebook: Rulebook, value: string): string {
  const prefixAliases = [...rulebook.refPrefixAliases].sort((a, b) => b[0].length - a[0].length);
  const normalized = applyPrefixAliases(normalizeClauseRefBase(value), prefixAliases);
  return rulebook.refAliasMap.get(normalized) ?? normalized;
}

export function obligationsForSection(rulebook: Rulebook, sectionKey: string): ObligationDef[] {
  return rulebook.obligations.filter((obligation) => obligation.sectionKeys.includes(sectionKey));
}

/**
 * Clause refs worth boosting during retrieval, derived from the system's open gaps.
 * Matches obligation vocabulary first, then rulebook-declared routing rules.
 */
export function preferredClauseRefsForGaps(rulebook: Rulebook, gapMessages: string[]): string[] {
  const haystack = gapMessages.join(" ").toLowerCase();
  if (!haystack.trim()) {
    return [];
  }

  const preferred: string[] = [];

  for (const obligation of rulebook.obligations) {
    const vocabulary = [
      obligation.clauseRef.toLowerCase(),
      obligation.title.toLowerCase(),
      ...obligation.sectionKeys.map((key) => key.replace(/-/g, " "))
    ];
    if (vocabulary.some((term) => haystack.includes(term))) {
      preferred.push(obligation.clauseRef);
    }
  }

  for (const rule of rulebook.compiledGapRouting) {
    if (rule.matcher.test(haystack)) {
      preferred.push(...rule.clauseRefs);
    }
  }

  return [...new Set(preferred)];
}

/** Section keys a rulebook expects the questionnaire to provide. */
export function requiredSectionKeys(rulebook: Rulebook): string[] {
  return [...new Set(rulebook.obligations.flatMap((obligation) => obligation.sectionKeys))].sort();
}
