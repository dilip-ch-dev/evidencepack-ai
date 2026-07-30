# Evaluation

Two offline suites, both runnable with no API key, no database, and no network:

| Command | What it measures |
| --- | --- |
| `npm run eval:gate` | Citation gate correctness, case by case |
| `npm run eval:retrieval` | Ranking quality on a golden set, plus a gap-routing ablation |
| `npm run eval:report` | Runs both, prints the tables below, writes `eval/results/latest.json` |
| `npm run eval:check` | Fails if results drift from the committed snapshot |

`eval/results/latest.json` is committed. A change that moves any number shows up as a
diff on that file, which is the point: the snapshot is the regression gate.

## Citation gate — `eval/gate-cases.json`

The gate is the load-bearing safety property. A recommendation survives only if it cites
a clause that was actually retrieved; everything else is dropped rather than repaired.
36 cases across three rulebooks, grouped by the behaviour they pin:

| Category | Cases | What it protects |
| --- | --- | --- |
| `exact-match` | 6 | Grounded citations survive |
| `format-variant` | 7 | `Art. 15`, `Article 10`, `ART 12`, `Art 15(4)`, trailing titles all resolve |
| `alias-folding` | 7 | `Art 11` resolves to `Art 11 + Annex IV`; `LLM8` to `LLM08`; `PR-07` to `PR07` |
| `fail-closed` | 7 | Real-but-unretrieved clauses are still dropped |
| `adversarial` | 6 | `Art 1` must not match `Art 15`; `LLM0` must not match `LLM01` |
| `malformed` | 3 | Empty, punctuation-only, and prose refs are dropped |

Current: **36/36 passing.**

The alias-folding cases exist because of a real precision/recall tradeoff. A model that
cites `Art 11` when the corpus ref is the compound `Art 11 + Annex IV` is misnaming a
real clause, not inventing one, and dropping it hid correct findings. Aliases are declared
per rulebook and folded before comparison — but only into refs that were actually
retrieved, so folding can never manufacture grounding. The `alias-not-retrieved` case
pins that boundary.

## Retrieval — `eval/retrieval-golden.json`

36 golden cases: a system description plus open gaps, and the clause(s) that should rank
in the top 5. 20 EU AI Act, 9 OWASP LLM Top 10, 7 production-readiness.

**What is and is not measured.** Production ranking has two stages: a pgvector
nearest-neighbour lookup, then a lexical + gap-aware rerank. Only the second stage is
deterministic and runnable without an embedding provider, so the harness offers every
clause in the corpus as a candidate at a neutral vector distance, reducing
`rerankCandidates` to its lexical and boost terms.

These numbers are therefore **a floor, not the production figure** — they say how well
the system ranks with no semantic signal at all. That is a deliberate trade: an
end-to-end number would be better marketing and worse engineering, because it would be
non-reproducible, cost money per run, and drift whenever the provider updates a model.

| Configuration | recall@5 | precision@5 | MRR | hit@1 |
| --- | --- | --- | --- | --- |
| gap-aware boost on | 88.9% | 19.4% | 0.849 | 80.6% |
| gap-aware boost off | 88.9% | 19.4% | 0.849 | 80.6% |

Precision@5 is low by construction: most cases have exactly one relevant clause, so the
ceiling is 20%.

Nine of the 36 cases are deliberately paraphrased into lay vocabulary ("a person needs to
be able to pull the plug" rather than "human oversight"). Four of them are the only cases
where a relevant clause falls outside the top 5, all at rank 6–7. That is the expected
shape: paraphrase is precisely what the vector stage exists to handle, and the gap
between this floor and production is the value the embedding step adds.

### Ablation: what gap-aware routing actually contributes

`preferredClauseRefsForGaps` boosts clauses whose vocabulary matches the system's open
gaps. Running the golden set with and without that boost:

- It reorders the top 5 in **11 of 36** cases.
- It changes the rank of a relevant clause in **0**.

So on this set the boost is net-neutral: it moves irrelevant clauses around and leaves
outcomes alone. It is retained because the offline arm understates it — with vector
distance neutralised, the lexical term is the whole signal, and the boost is a fixed
+0.08 against a term that maxes at 0.3.

**This ablation found a real defect.** Before it existed, the boost measurably *hurt*:
MRR 0.972 → 1.000 and hit@1 96.3% → 100% when disabled. Cause: routing rules only
targeted *scored* obligations, so corpus clauses outside the obligation catalog could
never receive a boost and were pushed down whenever any boost fired. `Art 72`
(post-market monitoring) fell from rank 1 to rank 4 on its own golden case. The fix was
routing coverage for the unscored clauses in `rulebooks/eu-ai-act-v2/rulebook.json`, and
`tests/unit/eval-harness.test.ts` now asserts the boost can never reduce MRR, recall, or
hit@1 again.

## Adding cases

Both files are plain JSON. A new gate case needs `rulebookId`, `category`, `retrieved`,
`recommendations`, `expectedKept`, and `expectedDroppedCount`. A new golden case needs
`rulebookId`, `query`, `gapMessages`, and `relevant`. Re-run `npm run eval:report` to
refresh the snapshot, and commit the diff alongside the change that caused it.

## Failure taxonomy — `eval/annotations.json`

Hard failures already show up in `AssessmentRun.stage`. The interesting defects are the
ones that *succeed*: a well-formed, fully grounded pack that is nonetheless wrong. Those
only become visible when someone looks at output and writes down what they saw.

Each observation carries four independent labels — `mode`, `severity`, `fixLocus`, and
`stage` — so a pile of complaints becomes a fix queue grouped by where the change goes.

| Command | What it does |
| --- | --- |
| `npm run taxonomy` | Summarise the labelled corpus and print the open fix queue |
| `npm run annotate -- --from-eval` | Emit unlabelled candidates from golden-set misses |
| `npm run annotate -- --from-db` | Emit candidates from thin/failed assessment runs |

`eval/annotation-worksheet.json` is gitignored. Label candidates by hand, then move the
ones worth keeping into `eval/annotations.json`. Nothing is auto-labelled.
