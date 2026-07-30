import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QUESTIONNAIRE_SECTION_KEYS } from "../../lib/questionnaire";
import {
  canonicalizeClauseRef,
  getRulebook,
  listRulebooks,
  normalizeClauseRefBase,
  preferredClauseRefsForGaps,
  requiredSectionKeys
} from "../../lib/rulebook";
import { parseClauseMarkdown, validateCorpus } from "../../lib/rulebook-corpus";
import { loadRulebookCorpus } from "../../lib/rulebook-corpus-fs";

describe("rulebook registry", () => {
  it("loads every shipped rulebook", () => {
    const ids = listRulebooks().map((rulebook) => rulebook.id).sort();
    assert.deepEqual(ids, [
      "eu-ai-act-v2",
      "llm-prod-readiness-v1",
      "owasp-llm-top10-v1"
    ]);
  });

  it("rejects an unknown rulebook id", () => {
    assert.throws(() => getRulebook("does-not-exist"), /Unknown rulebook/);
  });

  for (const rulebook of listRulebooks()) {
    describe(rulebook.id, () => {
      it("only maps obligations onto questionnaire sections that exist", () => {
        const unknown = requiredSectionKeys(rulebook).filter(
          (key) => !QUESTIONNAIRE_SECTION_KEYS.includes(key)
        );
        assert.deepEqual(unknown, [], `unknown section keys: ${unknown.join(", ")}`);
      });

      it("populates both readiness families", () => {
        const families = new Set(rulebook.obligations.map((o) => o.family));
        assert.ok(families.has("documentation"), "no documentation-family obligations");
        assert.ok(families.has("control"), "no control-family obligations");
      });

      it("has unique canonical clause refs", () => {
        const refs = rulebook.obligations.map((o) => canonicalizeClauseRef(rulebook, o.clauseRef));
        assert.equal(new Set(refs).size, refs.length, "duplicate canonical clause refs");
      });

      it("routes every gap rule to a ref that exists in the corpus", () => {
        const corpusRefs = new Set(
          loadRulebookCorpus(rulebook).map((chunk) => canonicalizeClauseRef(rulebook, chunk.clauseRef))
        );
        for (const rule of rulebook.gapRouting) {
          for (const ref of rule.clauseRefs) {
            assert.ok(
              corpusRefs.has(canonicalizeClauseRef(rulebook, ref)),
              `gap routing "${rule.pattern}" targets "${ref}", which is not in the corpus`
            );
          }
        }
      });

      it("has a corpus that covers every scored obligation", () => {
        const validation = validateCorpus(rulebook, loadRulebookCorpus(rulebook));
        assert.deepEqual(
          validation.uncitableObligations,
          [],
          "scored obligations with no clause text can be penalised but never cited"
        );
        assert.deepEqual(validation.duplicateRefs, [], "duplicate clause refs in corpus");
      });
    });
  }
});

describe("normalizeClauseRefBase", () => {
  it("strips a trailing title after an em dash", () => {
    assert.equal(normalizeClauseRefBase("Art 14 — Human oversight"), "art 14");
  });

  it("strips a trailing title after a spaced hyphen", () => {
    assert.equal(normalizeClauseRefBase("Art 14 - Human oversight"), "art 14");
  });

  it("preserves a bare hyphen inside an identifier", () => {
    assert.equal(normalizeClauseRefBase("PR-07"), "pr-07");
    assert.equal(normalizeClauseRefBase("LLM01-Prompt"), "llm01-prompt");
  });

  it("strips a trailing parenthetical and periods", () => {
    assert.equal(normalizeClauseRefBase("Art. 15(4)"), "art 15");
  });
});

describe("canonicalizeClauseRef", () => {
  const eu = getRulebook("eu-ai-act-v2");

  it("folds the long-form prefix", () => {
    assert.equal(canonicalizeClauseRef(eu, "Article 10"), "art 10");
  });

  it("folds a compound-reference alias to its canonical form", () => {
    assert.equal(canonicalizeClauseRef(eu, "Art 11"), "art 11 + annex iv");
    assert.equal(canonicalizeClauseRef(eu, "Annex IV"), "art 11 + annex iv");
  });

  it("leaves an unknown ref normalized but unmapped so the gate can reject it", () => {
    assert.equal(canonicalizeClauseRef(eu, "Art 99"), "art 99");
  });

  it("does not collapse distinct refs that share a prefix", () => {
    assert.notEqual(canonicalizeClauseRef(eu, "Art 1"), canonicalizeClauseRef(eu, "Art 15"));
  });
});

describe("preferredClauseRefsForGaps", () => {
  it("routes oversight gaps to the oversight obligation", () => {
    const preferred = preferredClauseRefsForGaps(getRulebook("eu-ai-act-v2"), [
      "Missing human oversight escalation procedure"
    ]);
    assert.ok(preferred.includes("Art 14"));
  });

  it("routes agent-permission gaps in the OWASP rulebook", () => {
    const preferred = preferredClauseRefsForGaps(getRulebook("owasp-llm-top10-v1"), [
      "Agent tool permissions exceed least privilege"
    ]);
    assert.ok(preferred.includes("LLM06"));
  });

  it("returns nothing for empty gap input", () => {
    assert.deepEqual(preferredClauseRefsForGaps(getRulebook("eu-ai-act-v2"), []), []);
  });
});

describe("parseClauseMarkdown", () => {
  it("splits the heading into ref and title", () => {
    const [chunk] = parseClauseMarkdown(
      "## Art 14 — Human oversight\n\nBody text here.\n\nKeywords: oversight, override\n"
    );
    assert.equal(chunk.clauseRef, "Art 14");
    assert.equal(chunk.title, "Human oversight");
    assert.equal(chunk.keywords, "oversight, override");
    assert.equal(chunk.text, "Body text here.");
  });

  it("ignores content before the first clause heading", () => {
    const chunks = parseClauseMarkdown(
      "# Title\n\nPreamble paragraph.\n\n## PR01 — Offline evaluation coverage\n\nBody.\n"
    );
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].clauseRef, "PR01");
  });

  it("drops sections with no body", () => {
    assert.equal(parseClauseMarkdown("## Art 14 — Human oversight\n").length, 0);
  });
});
