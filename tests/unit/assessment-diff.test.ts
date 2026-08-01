import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diffAssessments,
  formatDiff,
  type AssessmentSnapshot
} from "../../lib/assessment-diff";
import type { ScoreBreakdown } from "../../lib/scoring";

function breakdown(
  overrides: Partial<ScoreBreakdown> = {},
  obligations: Array<{ clauseRef: string; score: number; status: "covered" | "partial" | "missing" }> = []
): ScoreBreakdown {
  return {
    scoringVersion: "scoring_v2",
    rulebookId: "eu-ai-act-v2",
    score: 60,
    level: "Partially Ready",
    documentationReadiness: 60,
    controlReadiness: 60,
    familyLabels: { documentation: "Documentation readiness", control: "Control readiness" },
    components: {
      questionnaireCompletion: 60,
      evidenceCoverage: 60,
      staleEvidencePenalty: 0,
      missingEvidencePenalty: 0
    },
    obligations: obligations.map((row) => ({
      clauseRef: row.clauseRef,
      title: row.clauseRef,
      weight: 1,
      family: "control" as const,
      sectionKeys: [],
      answerCoverage: 1,
      evidenceCoverage: 1,
      score: row.score,
      status: row.status
    })),
    ...overrides
  };
}

function snapshot(overrides: Partial<AssessmentSnapshot> = {}): AssessmentSnapshot {
  return {
    id: "a1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    score: 60,
    level: "Partially Ready",
    summary: "Baseline posture.",
    scoringVersion: "scoring_v2",
    corpusVersion: "eu-ai-act-v2",
    recommendations: [{ text: "Document override procedures.", clauseRef: "Art 14" }],
    citations: [
      { clauseRef: "Art 14", title: "Human oversight", distance: 0.2 },
      { clauseRef: "Art 9", title: "Risk management", distance: 0.3 }
    ],
    breakdown: breakdown({}, [{ clauseRef: "Art 14", score: 60, status: "partial" }]),
    ...overrides
  };
}

describe("diffAssessments", () => {
  it("reports no change for identical assessments", () => {
    const diff = diffAssessments(snapshot(), snapshot({ id: "a2" }));

    assert.equal(diff.changed, false);
    assert.equal(diff.score.delta, 0);
    assert.deepEqual(diff.attributions.map((a) => a.code), ["no-change"]);
  });

  it("attributes a change to the scoring version when it moved", () => {
    const diff = diffAssessments(
      snapshot({ scoringVersion: "scoring_v1" }),
      snapshot({ id: "a2", scoringVersion: "scoring_v2", score: 71 })
    );

    assert.equal(diff.score.delta, 11);
    assert.ok(diff.attributions.some((a) => a.code === "scoring-version-changed"));
  });

  it("attributes a change to the corpus when the rulebook version moved", () => {
    const diff = diffAssessments(
      snapshot({ corpusVersion: "eu-ai-act-v1" }),
      snapshot({ id: "a2", corpusVersion: "eu-ai-act-v2" })
    );

    assert.ok(diff.attributions.some((a) => a.code === "corpus-version-changed"));
  });

  it("attributes retrieval movement under stable versions to changed system inputs", () => {
    const diff = diffAssessments(
      snapshot(),
      snapshot({
        id: "a2",
        citations: [
          { clauseRef: "Art 10", title: "Data governance", distance: 0.18 },
          { clauseRef: "Art 14", title: "Human oversight", distance: 0.25 }
        ]
      })
    );

    assert.deepEqual(diff.retrieval.added, ["art 10"]);
    assert.deepEqual(diff.retrieval.removed, ["art 9"]);
    assert.deepEqual(diff.retrieval.reordered, [
      { clauseRef: "art 14", fromRank: 1, toRank: 2 }
    ]);
    assert.ok(diff.attributions.some((a) => a.code === "system-inputs-changed"));
    assert.ok(!diff.attributions.some((a) => a.code === "model-nondeterminism"));
  });

  it("attributes prose-only movement under identical retrieval to the model", () => {
    const diff = diffAssessments(
      snapshot(),
      snapshot({
        id: "a2",
        summary: "Reworded posture.",
        recommendations: [{ text: "Write down the override path.", clauseRef: "Art 14" }]
      })
    );

    assert.equal(diff.retrieval.added.length, 0);
    assert.equal(diff.retrieval.removed.length, 0);
    assert.equal(diff.recommendations.rewritten.length, 1);
    const attribution = diff.attributions.find((a) => a.code === "model-nondeterminism");
    assert.ok(attribution);
    assert.equal(attribution?.confidence, "high");
  });

  it("lowers confidence in the nondeterminism call when the cited clause set also moved", () => {
    const diff = diffAssessments(
      snapshot(),
      snapshot({
        id: "a2",
        recommendations: [{ text: "Assess residual risk.", clauseRef: "Art 9" }]
      })
    );

    const attribution = diff.attributions.find((a) => a.code === "model-nondeterminism");
    assert.equal(attribution?.confidence, "medium");
    assert.deepEqual(diff.recommendations.addedClauseRefs, ["art 9"]);
    assert.deepEqual(diff.recommendations.removedClauseRefs, ["art 14"]);
  });

  it("detects an obligation catalog change", () => {
    const diff = diffAssessments(
      snapshot(),
      snapshot({
        id: "a2",
        breakdown: breakdown({}, [
          { clauseRef: "Art 14", score: 60, status: "partial" },
          { clauseRef: "Art 15", score: 40, status: "partial" }
        ])
      })
    );

    assert.ok(diff.attributions.some((a) => a.code === "obligation-catalog-changed"));
    assert.deepEqual(
      diff.obligations.filter((o) => o.presence === "added").map((o) => o.clauseRef),
      ["Art 15"]
    );
  });

  it("lists only obligations whose score or status moved", () => {
    const diff = diffAssessments(
      snapshot({
        breakdown: breakdown({}, [
          { clauseRef: "Art 14", score: 60, status: "partial" },
          { clauseRef: "Art 9", score: 90, status: "covered" }
        ])
      }),
      snapshot({
        id: "a2",
        breakdown: breakdown({}, [
          { clauseRef: "Art 14", score: 85, status: "covered" },
          { clauseRef: "Art 9", score: 90, status: "covered" }
        ])
      })
    );

    assert.deepEqual(diff.obligations.map((o) => o.clauseRef), ["Art 14"]);
    assert.equal(diff.obligations[0].scoreDelta, 25);
    assert.equal(diff.obligations[0].statusBefore, "partial");
    assert.equal(diff.obligations[0].statusAfter, "covered");
  });

  it("matches citations across reference formats", () => {
    const diff = diffAssessments(
      snapshot({
        citations: [{ clauseRef: "Art 14", title: "Human oversight", distance: 0.2 }],
        recommendations: [{ text: "Same finding.", clauseRef: "Art 14" }]
      }),
      snapshot({
        id: "a2",
        citations: [{ clauseRef: "Article 14 — Human oversight", title: "Human oversight", distance: 0.2 }],
        recommendations: [{ text: "Same finding.", clauseRef: "Art. 14" }]
      })
    );

    assert.equal(diff.retrieval.added.length, 0);
    assert.equal(diff.retrieval.removed.length, 0);
    assert.deepEqual(diff.recommendations.unchanged, ["art 14"]);
    assert.equal(diff.changed, false);
  });

  it("computes set similarity over the retrieved clauses", () => {
    const diff = diffAssessments(
      snapshot({ citations: [{ clauseRef: "Art 14", title: "t", distance: 0.1 }] }),
      snapshot({
        id: "a2",
        citations: [
          { clauseRef: "Art 14", title: "t", distance: 0.1 },
          { clauseRef: "Art 9", title: "t", distance: 0.2 }
        ]
      })
    );

    assert.equal(diff.retrieval.setSimilarity, 0.5);
  });
});

describe("formatDiff", () => {
  it("renders score movement and attribution", () => {
    const output = formatDiff(
      diffAssessments(snapshot(), snapshot({ id: "a2", score: 75, level: "Audit-Ready" }))
    ).join("\n");

    assert.match(output, /Score 60 -> 75 \(\+15\)/);
    assert.match(output, /level Partially Ready -> Audit-Ready/);
    assert.match(output, /Attribution:/);
  });
});
