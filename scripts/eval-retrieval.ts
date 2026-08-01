import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatPercent, formatRatio } from "@/lib/eval-metrics";
import { runGapBoostAblation, type GoldenCase } from "@/lib/eval-retrieval";

/**
 * Prints retrieval metrics on the golden set, plus the gap-boost ablation.
 *
 *   npm run eval:retrieval
 *   npm run eval:retrieval -- --k 3 --verbose
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const kIndex = args.indexOf("--k");
  return {
    topK: kIndex === -1 ? 5 : Number.parseInt(args[kIndex + 1] ?? "5", 10),
    verbose: args.includes("--verbose")
  };
}

function main() {
  const { topK, verbose } = parseArgs();
  const cases = JSON.parse(
    readFileSync(resolve("eval/retrieval-golden.json"), "utf8")
  ) as GoldenCase[];

  const ablation = runGapBoostAblation(cases, topK);
  const { withBoost, withoutBoost, delta } = ablation;

  console.log(`Retrieval eval — lexical rerank only, no embedding provider (k=${topK})`);
  console.log(`Golden cases: ${withBoost.aggregate.cases}\n`);

  console.log("Overall (gap-aware boost enabled):");
  console.log(`  recall@${topK}     ${formatPercent(withBoost.aggregate.meanRecall)}`);
  console.log(`  precision@${topK}  ${formatPercent(withBoost.aggregate.meanPrecision)}`);
  console.log(`  MRR           ${formatRatio(withBoost.aggregate.mrr)}`);
  console.log(`  hit@1         ${formatPercent(withBoost.aggregate.hitRateAtOne)}\n`);

  console.log("By rulebook:");
  for (const row of withBoost.byRulebook) {
    console.log(
      `  ${row.rulebookId.padEnd(22)} n=${String(row.aggregate.cases).padStart(2)}  ` +
        `recall@${topK} ${formatPercent(row.aggregate.meanRecall).padStart(6)}  ` +
        `MRR ${formatRatio(row.aggregate.mrr)}  ` +
        `hit@1 ${formatPercent(row.aggregate.hitRateAtOne).padStart(6)}`
    );
  }

  console.log("\nAblation — gap-aware clause routing:");
  console.log(
    `  with boost     recall@${topK} ${formatPercent(withBoost.aggregate.meanRecall)}  MRR ${formatRatio(withBoost.aggregate.mrr)}  hit@1 ${formatPercent(withBoost.aggregate.hitRateAtOne)}`
  );
  console.log(
    `  without boost  recall@${topK} ${formatPercent(withoutBoost.aggregate.meanRecall)}  MRR ${formatRatio(withoutBoost.aggregate.mrr)}  hit@1 ${formatPercent(withoutBoost.aggregate.hitRateAtOne)}`
  );
  console.log(
    `  delta          recall ${delta.meanRecall >= 0 ? "+" : ""}${formatPercent(delta.meanRecall)}  MRR ${delta.mrr >= 0 ? "+" : ""}${formatRatio(delta.mrr)}  hit@1 ${delta.hitRateAtOne >= 0 ? "+" : ""}${formatPercent(delta.hitRateAtOne)}`
  );

  const rankChanges = withBoost.perCase
    .map((withCase, index) => ({
      withCase,
      withoutCase: withoutBoost.perCase[index]
    }))
    .filter(
      ({ withCase, withoutCase }) =>
        withCase.metrics.firstRelevantRank !== withoutCase.metrics.firstRelevantRank
    );

  const reordered = withBoost.perCase.filter(
    (withCase, index) =>
      withCase.ranked.join("|") !== withoutBoost.perCase[index].ranked.join("|")
  );
  console.log(
    `\nBoost effect: reordered the top ${topK} in ${reordered.length}/${withBoost.perCase.length} cases, ` +
      `changed first-relevant rank in ${rankChanges.length}.`
  );

  if (rankChanges.length > 0) {
    console.log("\nCases where the boost changed the rank of the first relevant clause:");
    for (const { withCase, withoutCase } of rankChanges) {
      const before = withoutCase.metrics.firstRelevantRank ?? "never";
      const after = withCase.metrics.firstRelevantRank ?? "never";
      const direction = (after === "never" ? Infinity : after) > (before === "never" ? Infinity : before) ? "WORSE" : "better";
      console.log(`  ${withCase.id.padEnd(28)} rank ${before} -> ${after}  (${direction})`);
      console.log(`    expected: [${withCase.relevant.join(", ")}]`);
      console.log(`    with boost:    ${withCase.ranked.join(" > ")}`);
      console.log(`    without boost: ${withoutCase.ranked.join(" > ")}`);
    }
  }

  const misses = withBoost.perCase.filter((c) => c.metrics.recall < 1);
  console.log(`\nCases where a relevant clause fell outside the top ${topK}: ${misses.length}`);
  for (const miss of misses) {
    const rank = miss.metrics.firstRelevantRank;
    console.log(
      `  ${miss.id.padEnd(28)} expected [${miss.relevant.join(", ")}] ` +
        `first relevant at rank ${rank ?? "never"}`
    );
    if (verbose) {
      console.log(`    ranked: ${miss.ranked.join(" > ")}`);
    }
  }

  if (verbose) {
    console.log("\nPer-case detail:");
    for (const row of withBoost.perCase) {
      console.log(
        `  ${row.id.padEnd(28)} recall ${formatPercent(row.metrics.recall).padStart(6)}  ` +
          `rank ${String(row.metrics.firstRelevantRank ?? "-").padStart(3)}  ranked: ${row.ranked.join(" > ")}`
      );
    }
  }
}

main();
