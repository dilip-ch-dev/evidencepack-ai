import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { evaluateGateCase, type GateCase } from "@/lib/eval-gate";

/**
 * Citation-gate regression suite. Each case in `eval/gate-cases.json` becomes a test,
 * so a change to ref normalization or alias folding fails loudly and specifically.
 */

const cases = JSON.parse(
  readFileSync(resolve("eval/gate-cases.json"), "utf8")
) as GateCase[];

const byCategory = new Map<string, GateCase[]>();
for (const testCase of cases) {
  byCategory.set(testCase.category, [...(byCategory.get(testCase.category) ?? []), testCase]);
}

describe("citation gate", () => {
  it("has cases for every behaviour category", () => {
    for (const category of ["exact-match", "format-variant", "alias-folding", "fail-closed", "adversarial", "malformed"]) {
      assert.ok(
        (byCategory.get(category) ?? []).length > 0,
        `no gate cases cover category "${category}"`
      );
    }
  });

  it("exercises every rulebook", () => {
    const rulebooks = new Set(cases.map((c) => c.rulebookId));
    assert.ok(rulebooks.size >= 3, `expected cases across 3+ rulebooks, got ${rulebooks.size}`);
  });

  for (const [category, categoryCases] of byCategory) {
    describe(category, () => {
      for (const testCase of categoryCases) {
        it(`${testCase.id} — ${testCase.description}`, () => {
          const result = evaluateGateCase(testCase);
          assert.ok(result.passed, result.failureReason ?? "gate case failed");
        });
      }
    });
  }
});
