import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemCardFromHuggingFace } from "../../lib/huggingface";

describe("buildSystemCardFromHuggingFace", () => {
  it("rejects non-Hugging Face URLs", async () => {
    await assert.rejects(
      () => buildSystemCardFromHuggingFace("https://example.com/foo"),
      /Only huggingface\.co URLs/
    );
  });

  it("rejects missing owner/model format", async () => {
    await assert.rejects(
      () => buildSystemCardFromHuggingFace("mistral-7b"),
      /owner\/model slug/
    );
  });
});
