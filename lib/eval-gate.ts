import { filterGroundedRecommendations, normalizeClauseRef } from "@/lib/citations";
import { getRulebook } from "@/lib/rulebook";

/**
 * Evaluation of the citation gate against `eval/gate-cases.json`.
 *
 * The gate is the load-bearing safety property of the pipeline: a recommendation
 * may only survive if it cites a clause that was actually retrieved. These cases
 * pin both directions — grounded citations must survive format and alias variation,
 * and ungrounded ones must be dropped even when they name a real clause.
 */

export const GATE_CATEGORIES = [
  "exact-match",
  "format-variant",
  "alias-folding",
  "fail-closed",
  "adversarial",
  "malformed"
] as const;

export type GateCategory = (typeof GATE_CATEGORIES)[number];

export type GateCase = {
  id: string;
  rulebookId: string;
  category: GateCategory;
  description: string;
  retrieved: string[];
  recommendations: Array<{ text: string; clauseRef: string }>;
  expectedKept: string[];
  expectedDroppedCount: number;
};

export type GateCaseResult = {
  id: string;
  rulebookId: string;
  category: GateCategory;
  description: string;
  passed: boolean;
  /** Present only on failure, describing the first mismatch found. */
  failureReason?: string;
  actualKept: string[];
  actualDroppedCount: number;
};

export function evaluateGateCase(testCase: GateCase): GateCaseResult {
  const rulebook = getRulebook(testCase.rulebookId);
  const result = filterGroundedRecommendations(
    testCase.recommendations,
    testCase.retrieved.map((clauseRef) => ({ clauseRef })),
    rulebook
  );

  const actualKept = result.kept
    .map((item) => normalizeClauseRef(item.clauseRef, rulebook))
    .sort();
  const expectedKept = testCase.expectedKept
    .map((ref) => normalizeClauseRef(ref, rulebook))
    .sort();

  const base = {
    id: testCase.id,
    rulebookId: testCase.rulebookId,
    category: testCase.category,
    description: testCase.description,
    actualKept,
    actualDroppedCount: result.dropped.length
  };

  if (result.dropped.length !== testCase.expectedDroppedCount) {
    return {
      ...base,
      passed: false,
      failureReason: `expected ${testCase.expectedDroppedCount} dropped, got ${result.dropped.length}`
    };
  }

  if (actualKept.length !== expectedKept.length ||
      actualKept.some((ref, index) => ref !== expectedKept[index])) {
    return {
      ...base,
      passed: false,
      failureReason: `expected kept [${expectedKept.join(", ")}], got [${actualKept.join(", ")}]`
    };
  }

  return { ...base, passed: true };
}

export type GateSummary = {
  total: number;
  passed: number;
  failed: number;
  byCategory: Array<{ category: GateCategory; total: number; passed: number }>;
  failures: GateCaseResult[];
};

export function evaluateGateCases(cases: GateCase[]): GateSummary {
  const results = cases.map(evaluateGateCase);
  const categories = [...new Set(cases.map((c) => c.category))];

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    byCategory: categories.map((category) => {
      const inCategory = results.filter((r) => r.category === category);
      return {
        category,
        total: inCategory.length,
        passed: inCategory.filter((r) => r.passed).length
      };
    }),
    failures: results.filter((r) => !r.passed)
  };
}
