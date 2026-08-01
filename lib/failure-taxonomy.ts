import { z } from "zod";

/**
 * A taxonomy for classifying what went wrong in an assessment.
 *
 * The pipeline already records *where* a hard failure happened (the stage). That is not
 * enough for error analysis, because the interesting failures are the ones that succeed:
 * a run that returns a well-formed, fully grounded pack of advice that is nonetheless
 * wrong. Those have no error to log, so they only become visible if someone looks at
 * output and writes down what they saw.
 *
 * Each observation carries four independent labels. `mode` says what went wrong,
 * `severity` says whether it matters, and `fixLocus` says where the fix belongs — which
 * is what turns a pile of complaints into an ordered work queue.
 */

export const FAILURE_STAGES = [
  "embed",
  "retrieve",
  "generate",
  "parse",
  "persist",
  /** The run succeeded end to end; the output itself is the defect. */
  "output"
] as const;

export const FAILURE_MODES = {
  "retrieval-miss": "A clause that should ground the finding was never retrieved.",
  "retrieval-noise": "Retrieved clauses are irrelevant and crowd out the ones that matter.",
  "retrieval-rank-inversion": "The right clause was retrieved but ranked below weaker ones.",
  "citation-hallucination": "A cited clause was not in the retrieved set (the gate should catch this).",
  "citation-mismatch": "The cited clause was retrieved, but it does not support the claim made.",
  "gate-false-drop": "A correct, grounded recommendation was dropped by the citation gate.",
  "gate-false-keep": "An unsupported recommendation survived the citation gate.",
  "recommendation-generic": "Advice restates the clause without saying what this system should do.",
  "recommendation-inapplicable": "Advice contradicts or ignores facts the system already reported.",
  "summary-overclaim": "The summary asserts a posture the evidence does not support.",
  "scope-creep": "A finding falls outside the rulebook being assessed against.",
  "obligation-mapping-wrong": "A questionnaire section is mapped to the wrong obligation.",
  "score-disagreement": "The computed score materially disagrees with human judgement.",
  "schema-violation": "Model output did not satisfy the response schema.",
  "provider-error": "The model or embedding provider failed or rate-limited."
} as const;

export const FIX_LOCI = {
  "rulebook-data": "Fix in a rulebook manifest or clause corpus — no code change.",
  retrieval: "Fix in ranking: weights, candidate depth, or the embedding step.",
  prompt: "Fix in the generation prompt or response schema.",
  gate: "Fix in citation normalization, aliasing, or gate policy.",
  scoring: "Fix in the scoring model or obligation mapping.",
  infra: "Fix in retries, timeouts, or provider handling.",
  "eval-harness": "Not a product defect — the test case or metric is wrong."
} as const;

export const SEVERITIES = {
  blocking: "The pack cannot be used or would mislead a reviewer.",
  material: "A reviewer would notice and lose confidence, but the pack is usable.",
  cosmetic: "Wording or presentation only."
} as const;

export type FailureStage = (typeof FAILURE_STAGES)[number];
export type FailureMode = keyof typeof FAILURE_MODES;
export type FixLocus = keyof typeof FIX_LOCI;
export type Severity = keyof typeof SEVERITIES;

export const observationSchema = z.object({
  id: z.string().min(1),
  /** Where this was seen: an eval case id, an AssessmentRun id, or a review note. */
  source: z.string().min(1),
  observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rulebookId: z.string().min(1),
  stage: z.enum(FAILURE_STAGES),
  mode: z.enum(Object.keys(FAILURE_MODES) as [FailureMode, ...FailureMode[]]),
  severity: z.enum(Object.keys(SEVERITIES) as [Severity, ...Severity[]]),
  fixLocus: z.enum(Object.keys(FIX_LOCI) as [FixLocus, ...FixLocus[]]),
  /** Concrete, checkable evidence — a rank, a ref, a quoted line. */
  evidence: z.string().min(1),
  status: z.enum(["open", "fixed", "accepted"]),
  /** For `fixed`, what resolved it. For `accepted`, why it is tolerable. */
  resolution: z.string().optional()
});

export type FailureObservation = z.infer<typeof observationSchema>;

export function parseObservations(raw: unknown): FailureObservation[] {
  const parsed = z.array(observationSchema).safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid failure annotations: ${parsed.error.message}`);
  }

  const ids = parsed.data.map((observation) => observation.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) {
    throw new Error(`Duplicate observation id "${duplicate}".`);
  }

  for (const observation of parsed.data) {
    if (observation.status !== "open" && !observation.resolution) {
      throw new Error(
        `Observation "${observation.id}" is ${observation.status} but records no resolution.`
      );
    }
  }

  return parsed.data;
}

export type Bucket<T extends string> = { key: T; label: string; total: number; open: number };

function bucket<T extends string>(
  observations: FailureObservation[],
  pick: (observation: FailureObservation) => T,
  labels: Record<string, string>
): Bucket<T>[] {
  const keys = [...new Set(observations.map(pick))];
  return keys
    .map((key) => {
      const inBucket = observations.filter((observation) => pick(observation) === key);
      return {
        key,
        label: labels[key] ?? key,
        total: inBucket.length,
        open: inBucket.filter((observation) => observation.status === "open").length
      };
    })
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

const SEVERITY_RANK: Record<Severity, number> = { blocking: 0, material: 1, cosmetic: 2 };

export type TaxonomyReport = {
  total: number;
  open: number;
  fixed: number;
  accepted: number;
  byMode: Bucket<FailureMode>[];
  byFixLocus: Bucket<FixLocus>[];
  byStage: Bucket<FailureStage>[];
  bySeverity: Bucket<Severity>[];
  /**
   * Open work grouped by where the fix goes, most severe first. Grouping by locus
   * rather than by symptom is what makes the list actionable: everything in one group
   * is fixed in the same file by the same kind of change.
   */
  fixQueue: Array<{
    fixLocus: FixLocus;
    label: string;
    observations: FailureObservation[];
  }>;
};

export function buildTaxonomyReport(observations: FailureObservation[]): TaxonomyReport {
  const open = observations.filter((observation) => observation.status === "open");

  const lociByPriority = [...new Set(open.map((observation) => observation.fixLocus))].sort(
    (a, b) => {
      const worst = (locus: FixLocus) =>
        Math.min(
          ...open
            .filter((observation) => observation.fixLocus === locus)
            .map((observation) => SEVERITY_RANK[observation.severity])
        );
      return (
        worst(a) - worst(b) ||
        open.filter((o) => o.fixLocus === b).length - open.filter((o) => o.fixLocus === a).length
      );
    }
  );

  return {
    total: observations.length,
    open: open.length,
    fixed: observations.filter((observation) => observation.status === "fixed").length,
    accepted: observations.filter((observation) => observation.status === "accepted").length,
    byMode: bucket(observations, (o) => o.mode, FAILURE_MODES),
    byFixLocus: bucket(observations, (o) => o.fixLocus, FIX_LOCI),
    byStage: bucket(observations, (o) => o.stage, {}),
    bySeverity: bucket(observations, (o) => o.severity, SEVERITIES),
    fixQueue: lociByPriority.map((fixLocus) => ({
      fixLocus,
      label: FIX_LOCI[fixLocus],
      observations: open
        .filter((observation) => observation.fixLocus === fixLocus)
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    }))
  };
}
