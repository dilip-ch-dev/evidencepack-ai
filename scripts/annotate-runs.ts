import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGapBoostAblation, type GoldenCase } from "@/lib/eval-retrieval";
import { parseObservations } from "@/lib/failure-taxonomy";
import { prisma } from "@/lib/prisma";

/**
 * Produces a labelling worksheet of things worth looking at, so error analysis starts
 * from evidence rather than from memory. Candidates come from two places:
 *
 *   npm run annotate -- --from-eval    reproducible misses in the golden set (no DB)
 *   npm run annotate -- --from-db      recent assessment runs worth reviewing
 *
 * Output is written to eval/annotation-worksheet.json, which is gitignored. Fill in the
 * taxonomy labels by hand, then move the entries you keep into eval/annotations.json.
 * Nothing is auto-labelled: a label asserted without a human looking at the output is
 * exactly the kind of unverified claim this pipeline exists to prevent.
 */

const WORKSHEET_PATH = resolve("eval/annotation-worksheet.json");

type Candidate = {
  suggestedSource: string;
  reason: string;
  evidence: string;
  /** Left blank for a human to fill in. */
  stage: string;
  mode: string;
  severity: string;
  fixLocus: string;
  status: "open";
};

function blankLabels() {
  return { stage: "", mode: "", severity: "", fixLocus: "", status: "open" as const };
}

function fromEval(): Candidate[] {
  const goldenCases = JSON.parse(
    readFileSync(resolve("eval/retrieval-golden.json"), "utf8")
  ) as GoldenCase[];

  const { withBoost } = runGapBoostAblation(goldenCases, 5);

  return withBoost.perCase
    .filter((result) => result.metrics.recall < 1)
    .map((result) => ({
      suggestedSource: `eval:retrieval-golden/${result.id}`,
      reason: "A relevant clause fell outside the top 5.",
      evidence:
        `Expected [${result.relevant.join(", ")}]; first relevant clause at rank ` +
        `${result.metrics.firstRelevantRank ?? "never"}. Ranked: ${result.ranked.join(" > ")}.`,
      ...blankLabels()
    }));
}

async function fromDb(): Promise<Candidate[]> {
  const runs = await prisma.assessmentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });

  // Runs worth a human look: anything that failed, and anything that succeeded while
  // dropping citations or retrieving thinly — the quiet quality failures.
  return runs
    .filter(
      (run) =>
        run.status !== "success" ||
        (run.droppedCitations ?? 0) > 0 ||
        (run.retrievedCount ?? 0) < 3
    )
    .map((run) => ({
      suggestedSource: `run:${run.id}`,
      reason:
        run.status !== "success"
          ? `Run ${run.status} at stage ${run.stage ?? "unknown"}.`
          : (run.droppedCitations ?? 0) > 0
            ? `Succeeded but dropped ${run.droppedCitations} citation(s).`
            : `Succeeded on thin retrieval (${run.retrievedCount} clauses).`,
      evidence:
        `system=${run.systemId} corpus=${run.corpusVersion ?? "?"} scoring=${run.scoringVersion ?? "?"} ` +
        `retrieved=${run.retrievedCount ?? 0} dropped=${run.droppedCitations ?? 0} ` +
        `latency=${run.latencyMs ?? "?"}ms${run.errorMessage ? ` error="${run.errorMessage}"` : ""}`,
      ...blankLabels()
    }));
}

async function main() {
  const useDb = process.argv.includes("--from-db");
  const useEval = process.argv.includes("--from-eval") || !useDb;

  const candidates: Candidate[] = [];
  if (useEval) {
    candidates.push(...fromEval());
  }
  if (useDb) {
    candidates.push(...(await fromDb()));
  }

  // Surface annotation-file problems here rather than at report time.
  const existing = parseObservations(
    JSON.parse(readFileSync(resolve("eval/annotations.json"), "utf8"))
  );
  const alreadyLabelled = new Set(existing.map((observation) => observation.source));
  const fresh = candidates.filter(
    (candidate) => !alreadyLabelled.has(candidate.suggestedSource)
  );

  writeFileSync(WORKSHEET_PATH, `${JSON.stringify(fresh, null, 2)}\n`, "utf8");

  console.log(
    `${candidates.length} candidate(s) found, ${candidates.length - fresh.length} already labelled.`
  );
  console.log(`Wrote ${fresh.length} unlabelled candidate(s) to ${WORKSHEET_PATH}.`);
  console.log(
    "Label them by hand, then move the ones worth keeping into eval/annotations.json."
  );
}

main()
  .catch((error) => {
    console.error("Annotation worksheet failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
