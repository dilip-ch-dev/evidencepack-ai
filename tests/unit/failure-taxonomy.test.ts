import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  buildTaxonomyReport,
  parseObservations,
  type FailureObservation
} from "../../lib/failure-taxonomy";

function observation(
  overrides: Partial<FailureObservation> & Pick<FailureObservation, "id" | "mode" | "fixLocus" | "severity" | "status">
): FailureObservation {
  return {
    source: "test",
    observedAt: "2026-07-30",
    rulebookId: "eu-ai-act-v2",
    stage: "output",
    evidence: "test evidence",
    ...overrides
  };
}

describe("parseObservations", () => {
  it("accepts the committed annotation corpus", () => {
    const raw = JSON.parse(readFileSync(resolve("eval/annotations.json"), "utf8"));
    const observations = parseObservations(raw);
    assert.ok(observations.length >= 8);
    assert.ok(observations.every((row) => row.id.startsWith("obs-")));
  });

  it("rejects duplicate ids", () => {
    assert.throws(
      () =>
        parseObservations([
          observation({ id: "a", mode: "retrieval-miss", fixLocus: "retrieval", severity: "material", status: "open" }),
          observation({ id: "a", mode: "provider-error", fixLocus: "infra", severity: "blocking", status: "open" })
        ]),
      /Duplicate observation id/
    );
  });

  it("requires a resolution for fixed and accepted rows", () => {
    assert.throws(
      () =>
        parseObservations([
          observation({
            id: "fixed-no-note",
            mode: "gate-false-drop",
            fixLocus: "gate",
            severity: "material",
            status: "fixed"
          })
        ]),
      /records no resolution/
    );
  });
});

describe("buildTaxonomyReport", () => {
  const corpus: FailureObservation[] = [
    observation({
      id: "1",
      mode: "citation-mismatch",
      fixLocus: "eval-harness",
      severity: "blocking",
      status: "open"
    }),
    observation({
      id: "2",
      mode: "retrieval-miss",
      fixLocus: "retrieval",
      severity: "material",
      status: "open"
    }),
    observation({
      id: "3",
      mode: "summary-overclaim",
      fixLocus: "prompt",
      severity: "cosmetic",
      status: "open"
    }),
    observation({
      id: "4",
      mode: "gate-false-drop",
      fixLocus: "gate",
      severity: "material",
      status: "fixed",
      resolution: "alias folding"
    }),
    observation({
      id: "5",
      mode: "obligation-mapping-wrong",
      fixLocus: "rulebook-data",
      severity: "material",
      status: "accepted",
      resolution: "deferred to scoring_v3"
    })
  ];

  it("counts open, fixed, and accepted separately", () => {
    const report = buildTaxonomyReport(corpus);
    assert.equal(report.total, 5);
    assert.equal(report.open, 3);
    assert.equal(report.fixed, 1);
    assert.equal(report.accepted, 1);
  });

  it("orders the fix queue by worst open severity, then by volume", () => {
    const report = buildTaxonomyReport(corpus);
    assert.deepEqual(
      report.fixQueue.map((group) => group.fixLocus),
      ["eval-harness", "retrieval", "prompt"]
    );
    assert.equal(report.fixQueue[0]?.observations[0]?.id, "1");
  });

  it("excludes resolved rows from the fix queue", () => {
    const report = buildTaxonomyReport(corpus);
    const queuedIds = report.fixQueue.flatMap((group) => group.observations.map((row) => row.id));
    assert.ok(!queuedIds.includes("4"));
    assert.ok(!queuedIds.includes("5"));
  });

  it("buckets modes with open counts", () => {
    const report = buildTaxonomyReport(corpus);
    const mismatch = report.byMode.find((bucket) => bucket.key === "citation-mismatch");
    assert.equal(mismatch?.total, 1);
    assert.equal(mismatch?.open, 1);
    const fixedGate = report.byMode.find((bucket) => bucket.key === "gate-false-drop");
    assert.equal(fixedGate?.open, 0);
  });
});
