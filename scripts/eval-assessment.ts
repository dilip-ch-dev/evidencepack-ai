import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  filterGroundedRecommendations,
  normalizeArticleRef
} from "../lib/citations";

type CorpusCase = {
  id: string;
  description: string;
  mockRetrieved: Array<{ articleRef: string; title: string }>;
  mockRecommendations: Array<{ text: string; articleRef: string }>;
  expectedKeptArticleRefs: string[];
  expectedDroppedCount: number;
};

const corpus = JSON.parse(
  readFileSync(resolve("eval/corpus.json"), "utf8")
) as CorpusCase[];

describe("eval corpus — grounded citation gate", () => {
  for (const testCase of corpus) {
    it(testCase.id, () => {
      const result = filterGroundedRecommendations(
        testCase.mockRecommendations,
        testCase.mockRetrieved
      );

      assert.equal(
        result.dropped.length,
        testCase.expectedDroppedCount,
        testCase.description
      );

      const keptNormalized = result.kept
        .map((item) => normalizeArticleRef(item.articleRef))
        .sort();
      const expectedNormalized = testCase.expectedKeptArticleRefs
        .map((ref) => normalizeArticleRef(ref))
        .sort();

      assert.deepEqual(keptNormalized, expectedNormalized, testCase.description);
      assert.ok(result.kept.length > 0, "fail-closed gate must keep at least one grounded citation");
    });
  }
});
