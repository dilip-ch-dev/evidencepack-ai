import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterGroundedRecommendations,
  normalizeArticleRef
} from "../../lib/citations";
import { computeReadinessScore, deriveLevel } from "../../lib/assessment";
import type { GapMetrics } from "../../lib/gaps";
import { parseSystemCard } from "../../lib/system-card";
import { computeScoreBreakdown } from "../../lib/scoring";
import { preferredArticlesForGaps } from "../../lib/obligations";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("normalizeArticleRef", () => {
  it("normalizes common article formats", () => {
    assert.equal(normalizeArticleRef("Art 14"), "art 14");
    assert.equal(normalizeArticleRef("Art. 14"), "art 14");
    assert.equal(normalizeArticleRef("Article 14"), "art 14");
    assert.equal(normalizeArticleRef("Art 14 — Human oversight"), "art 14");
  });
});

describe("filterGroundedRecommendations", () => {
  it("keeps only citations present in retrieved clauses", () => {
    const result = filterGroundedRecommendations(
      [
        { text: "Add oversight stop button", articleRef: "Art 14" },
        { text: "Invented", articleRef: "Art 99" },
        { text: "Data governance", articleRef: "Article 10" }
      ],
      [{ articleRef: "Art 14" }, { articleRef: "Art 10" }]
    );

    assert.equal(result.kept.length, 2);
    assert.equal(result.dropped.length, 1);
    assert.deepEqual(
      result.kept.map((item) => normalizeArticleRef(item.articleRef)).sort(),
      ["art 10", "art 14"]
    );
  });
});

describe("computeReadinessScore", () => {
  it("scores complete coverage highly", () => {
    const metrics: GapMetrics = {
      totalRequiredQuestions: 10,
      answeredRequiredQuestions: 10,
      totalSections: 10,
      sectionsWithEvidence: 10,
      missingEvidenceSections: 0,
      missingRequiredSections: 0,
      unansweredQuestions: 0,
      totalEvidence: 10,
      staleEvidenceCount: 0
    };

    const score = computeReadinessScore(metrics);
    assert.equal(score, 100);
    assert.equal(deriveLevel(score), "Audit-Ready");
  });

  it("penalizes stale and missing evidence", () => {
    const metrics: GapMetrics = {
      totalRequiredQuestions: 10,
      answeredRequiredQuestions: 5,
      totalSections: 10,
      sectionsWithEvidence: 5,
      missingEvidenceSections: 5,
      missingRequiredSections: 2,
      unansweredQuestions: 5,
      totalEvidence: 5,
      staleEvidenceCount: 2
    };

    const score = computeReadinessScore(metrics);
    assert.equal(score, 25);
    assert.equal(deriveLevel(score), "Not Ready");
  });
});

describe("scoring_v2 obligation coverage", () => {
  it("produces documentation/control split and obligation rows", () => {
    const metrics: GapMetrics = {
      totalRequiredQuestions: 4,
      answeredRequiredQuestions: 4,
      totalSections: 4,
      sectionsWithEvidence: 2,
      missingEvidenceSections: 2,
      missingRequiredSections: 0,
      unansweredQuestions: 0,
      totalEvidence: 2,
      staleEvidenceCount: 0
    };

    const breakdown = computeScoreBreakdown(
      metrics,
      [
        {
          sectionKey: "human-oversight",
          title: "Human Oversight",
          requiredQuestions: 1,
          answeredRequired: 1,
          hasEvidence: true,
          staleEvidence: false
        },
        {
          sectionKey: "data-sources",
          title: "Data Sources",
          requiredQuestions: 1,
          answeredRequired: 1,
          hasEvidence: false,
          staleEvidence: false
        },
        {
          sectionKey: "risk-controls",
          title: "Risk Controls",
          requiredQuestions: 1,
          answeredRequired: 1,
          hasEvidence: true,
          staleEvidence: false
        },
        {
          sectionKey: "monitoring",
          title: "Monitoring",
          requiredQuestions: 1,
          answeredRequired: 1,
          hasEvidence: false,
          staleEvidence: false
        }
      ],
      "scoring_v2"
    );

    assert.equal(breakdown.scoringVersion, "scoring_v2");
    assert.ok(breakdown.obligations.length >= 5);
    assert.ok(breakdown.documentationReadiness >= 0);
    assert.ok(breakdown.controlReadiness >= 0);
    assert.ok(breakdown.score >= 0 && breakdown.score <= 100);
  });
});

describe("preferredArticlesForGaps", () => {
  it("boosts oversight articles for oversight gaps", () => {
    const preferred = preferredArticlesForGaps([
      "Missing human oversight escalation procedure"
    ]);
    assert.ok(preferred.includes("Art 14"));
  });
});

describe("parseSystemCard", () => {
  it("parses the example JSON system card", () => {
    const raw = readFileSync(resolve("examples/system-card.json"), "utf8");
    const parsed = parseSystemCard(raw);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.card.system.systemName, "EU Invoice Anomaly Detector");
    assert.ok(Object.keys(parsed.card.answers).length >= 5);
    assert.ok(parsed.card.evidence.length >= 1);
  });

  it("parses the example Markdown system card", () => {
    const raw = readFileSync(resolve("examples/system-card.md"), "utf8");
    const parsed = parseSystemCard(raw);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.card.system.systemName, "EU Resume Ranker");
    assert.ok(parsed.card.answers["overview-main-function"]);
    assert.equal(parsed.card.evidence[0]?.type, "URL");
  });
});
