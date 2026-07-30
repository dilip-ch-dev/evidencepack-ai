import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { evaluateGateCases, type GateCase } from "../../lib/eval-gate";
import { aggregateMetrics, computeRankingMetrics } from "../../lib/eval-metrics";
import { runGapBoostAblation, type GoldenCase } from "../../lib/eval-retrieval";
import { getRulebook } from "../../lib/rulebook";

const goldenCases = JSON.parse(
  readFileSync(resolve("eval/retrieval-golden.json"), "utf8")
) as GoldenCase[];

const gateCases = JSON.parse(
  readFileSync(resolve("eval/gate-cases.json"), "utf8")
) as GateCase[];

describe("computeRankingMetrics", () => {
  it("scores a perfect ranking", () => {
    const metrics = computeRankingMetrics(["a", "b", "c"], ["a"], 3);
    assert.equal(metrics.recall, 1);
    assert.equal(metrics.reciprocalRank, 1);
    assert.equal(metrics.hitAtOne, 1);
    assert.equal(metrics.firstRelevantRank, 1);
  });

  it("halves reciprocal rank when the relevant item is second", () => {
    const metrics = computeRankingMetrics(["x", "a"], ["a"], 5);
    assert.equal(metrics.reciprocalRank, 0.5);
    assert.equal(metrics.hitAtOne, 0);
  });

  it("reports partial recall when only some relevant items are in the top-k", () => {
    const metrics = computeRankingMetrics(["a", "x", "y", "b"], ["a", "b"], 2);
    assert.equal(metrics.recall, 0.5);
    assert.equal(metrics.precision, 0.5);
  });

  it("measures reciprocal rank beyond k so near-misses stay visible", () => {
    const metrics = computeRankingMetrics(["x", "y", "z", "a"], ["a"], 2);
    assert.equal(metrics.recall, 0);
    assert.equal(metrics.firstRelevantRank, 4);
    assert.equal(metrics.reciprocalRank, 0.25);
  });

  it("scores zero when nothing relevant is ranked", () => {
    const metrics = computeRankingMetrics(["x", "y"], ["a"], 2);
    assert.equal(metrics.recall, 0);
    assert.equal(metrics.reciprocalRank, 0);
    assert.equal(metrics.firstRelevantRank, null);
  });

  it("counts a duplicated relevant hit once", () => {
    const metrics = computeRankingMetrics(["a", "a"], ["a", "b"], 2);
    assert.equal(metrics.recall, 0.5);
  });

  it("returns zeroed aggregates for an empty run", () => {
    assert.deepEqual(aggregateMetrics([]), {
      cases: 0,
      meanRecall: 0,
      meanPrecision: 0,
      mrr: 0,
      hitRateAtOne: 0
    });
  });
});

describe("gate case corpus", () => {
  it("passes every committed case", () => {
    const summary = evaluateGateCases(gateCases);
    assert.equal(
      summary.failed,
      0,
      summary.failures.map((f) => `${f.id}: ${f.failureReason}`).join("; ")
    );
  });

  it("references only rulebooks that exist", () => {
    for (const testCase of gateCases) {
      assert.doesNotThrow(() => getRulebook(testCase.rulebookId), `unknown rulebook in ${testCase.id}`);
    }
  });

  it("has unique case ids", () => {
    const ids = gateCases.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate gate case id");
  });
});

describe("retrieval golden set", () => {
  it("has unique case ids", () => {
    const ids = goldenCases.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate golden case id");
  });

  it("marks at least one relevant clause per case", () => {
    for (const goldenCase of goldenCases) {
      assert.ok(goldenCase.relevant.length > 0, `${goldenCase.id} has no relevant clauses`);
    }
  });

  /**
   * Regression guard for a real defect: gap-aware routing originally boosted only
   * scored obligations, which demoted corpus clauses outside the obligation catalog
   * (Art 72 fell from rank 1 to rank 4). The boost must never make ranking worse.
   */
  it("gap-aware boost never degrades ranking quality", () => {
    const { withBoost, withoutBoost, delta } = runGapBoostAblation(goldenCases, 5);

    assert.ok(
      delta.mrr >= 0,
      `gap boost reduced MRR from ${withoutBoost.aggregate.mrr.toFixed(3)} to ${withBoost.aggregate.mrr.toFixed(3)}`
    );
    assert.ok(
      delta.meanRecall >= 0,
      `gap boost reduced recall from ${withoutBoost.aggregate.meanRecall.toFixed(3)} to ${withBoost.aggregate.meanRecall.toFixed(3)}`
    );
    assert.ok(
      delta.hitRateAtOne >= 0,
      `gap boost reduced hit@1 from ${withoutBoost.aggregate.hitRateAtOne.toFixed(3)} to ${withBoost.aggregate.hitRateAtOne.toFixed(3)}`
    );
  });

  it("no relevant clause is unreachable by the lexical reranker", () => {
    const { withBoost } = runGapBoostAblation(goldenCases, 5);
    const unreachable = withBoost.perCase.filter((c) => c.metrics.firstRelevantRank === null);
    assert.deepEqual(
      unreachable.map((c) => c.id),
      [],
      "a relevant clause never appears in the ranking at all"
    );
  });
});
