import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateGateCases, type GateCase } from "@/lib/eval-gate";
import { formatPercent, formatRatio } from "@/lib/eval-metrics";
import { runGapBoostAblation, type GoldenCase } from "@/lib/eval-retrieval";
import { listRulebooks } from "@/lib/rulebook";
import { loadRulebookCorpus } from "@/lib/rulebook-corpus-fs";
import { validateCorpus } from "@/lib/rulebook-corpus";

/**
 * Runs every offline evaluation and writes a committed snapshot to
 * `eval/results/latest.json`, so the numbers quoted in the README are reproducible
 * and a diff on that file shows exactly what a change moved.
 *
 *   npm run eval:report
 *   npm run eval:report -- --check   (fails if results drift from the snapshot)
 */

const RESULTS_PATH = resolve("eval/results/latest.json");
const TOP_K = 5;

type Snapshot = {
  topK: number;
  gate: { total: number; passed: number; byCategory: Array<{ category: string; total: number; passed: number }> };
  retrieval: {
    cases: number;
    withBoost: { recall: number; precision: number; mrr: number; hitAtOne: number };
    withoutBoost: { recall: number; precision: number; mrr: number; hitAtOne: number };
  };
  rulebooks: Array<{ id: string; obligations: number; clauses: number; corpusValid: boolean }>;
};

function round(value: number): number {
  return Number(value.toFixed(4));
}

function buildSnapshot(): Snapshot {
  const gateCases = JSON.parse(
    readFileSync(resolve("eval/gate-cases.json"), "utf8")
  ) as GateCase[];
  const goldenCases = JSON.parse(
    readFileSync(resolve("eval/retrieval-golden.json"), "utf8")
  ) as GoldenCase[];

  const gate = evaluateGateCases(gateCases);
  const { withBoost, withoutBoost } = runGapBoostAblation(goldenCases, TOP_K);

  return {
    topK: TOP_K,
    gate: {
      total: gate.total,
      passed: gate.passed,
      byCategory: gate.byCategory.map((row) => ({
        category: row.category,
        total: row.total,
        passed: row.passed
      }))
    },
    retrieval: {
      cases: withBoost.aggregate.cases,
      withBoost: {
        recall: round(withBoost.aggregate.meanRecall),
        precision: round(withBoost.aggregate.meanPrecision),
        mrr: round(withBoost.aggregate.mrr),
        hitAtOne: round(withBoost.aggregate.hitRateAtOne)
      },
      withoutBoost: {
        recall: round(withoutBoost.aggregate.meanRecall),
        precision: round(withoutBoost.aggregate.meanPrecision),
        mrr: round(withoutBoost.aggregate.mrr),
        hitAtOne: round(withoutBoost.aggregate.hitRateAtOne)
      }
    },
    rulebooks: listRulebooks().map((rulebook) => {
      const chunks = loadRulebookCorpus(rulebook);
      return {
        id: rulebook.id,
        obligations: rulebook.obligations.length,
        clauses: chunks.length,
        corpusValid: validateCorpus(rulebook, chunks).ok
      };
    })
  };
}

function printMarkdown(snapshot: Snapshot) {
  const { gate, retrieval, rulebooks } = snapshot;

  console.log(`### Citation gate\n`);
  console.log(`${gate.passed}/${gate.total} cases pass.\n`);
  console.log("| Category | Cases | Passing |");
  console.log("| --- | --- | --- |");
  for (const row of gate.byCategory) {
    console.log(`| ${row.category} | ${row.total} | ${row.passed} |`);
  }

  console.log(`\n### Retrieval (lexical rerank only, k=${snapshot.topK}, n=${retrieval.cases})\n`);
  console.log("| Configuration | recall@5 | precision@5 | MRR | hit@1 |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const [label, row] of [
    ["gap-aware boost on", retrieval.withBoost],
    ["gap-aware boost off", retrieval.withoutBoost]
  ] as const) {
    console.log(
      `| ${label} | ${formatPercent(row.recall)} | ${formatPercent(row.precision)} | ${formatRatio(row.mrr)} | ${formatPercent(row.hitAtOne)} |`
    );
  }

  console.log(`\n### Rulebooks\n`);
  console.log("| Rulebook | Scored obligations | Clauses ingested | Corpus valid |");
  console.log("| --- | --- | --- | --- |");
  for (const row of rulebooks) {
    console.log(`| \`${row.id}\` | ${row.obligations} | ${row.clauses} | ${row.corpusValid ? "yes" : "NO"} |`);
  }
}

function main() {
  const check = process.argv.includes("--check");
  const snapshot = buildSnapshot();

  if (check) {
    const previous = JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Snapshot;
    const current = JSON.stringify(snapshot, null, 2);
    if (JSON.stringify(previous, null, 2) !== current) {
      console.error(
        "Eval results differ from eval/results/latest.json. Review the change, then run `npm run eval:report` to update the snapshot."
      );
      printMarkdown(snapshot);
      process.exitCode = 1;
      return;
    }
    console.log("Eval results match the committed snapshot.");
    return;
  }

  mkdirSync(resolve("eval/results"), { recursive: true });
  writeFileSync(RESULTS_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Wrote ${RESULTS_PATH}\n`);
  printMarkdown(snapshot);

  if (snapshot.gate.passed !== snapshot.gate.total) {
    process.exitCode = 1;
  }
}

main();
