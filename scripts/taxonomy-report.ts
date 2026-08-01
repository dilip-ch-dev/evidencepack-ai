import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildTaxonomyReport,
  parseObservations,
  type FailureObservation
} from "@/lib/failure-taxonomy";

/**
 * Summarises the labelled failure corpus and prints the resulting fix queue.
 *
 *   npm run taxonomy
 *   npm run taxonomy -- --open      only open observations
 *   npm run taxonomy -- --json
 */

function table(rows: Array<{ key: string; total: number; open: number }>, heading: string) {
  if (rows.length === 0) {
    return;
  }
  const width = Math.max(heading.length, ...rows.map((row) => row.key.length));
  console.log(`\n${heading.padEnd(width)}  total  open`);
  console.log(`${"-".repeat(width)}  -----  ----`);
  for (const row of rows) {
    console.log(
      `${row.key.padEnd(width)}  ${String(row.total).padStart(5)}  ${String(row.open).padStart(4)}`
    );
  }
}

function main() {
  const raw = JSON.parse(readFileSync(resolve("eval/annotations.json"), "utf8"));
  const all = parseObservations(raw);
  const openOnly = process.argv.includes("--open");
  const observations: FailureObservation[] = openOnly
    ? all.filter((observation) => observation.status === "open")
    : all;

  const report = buildTaxonomyReport(observations);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    `Failure corpus: ${report.total} observations — ${report.open} open, ${report.fixed} fixed, ${report.accepted} accepted.`
  );

  table(report.bySeverity, "severity");
  table(report.byMode, "failure mode");
  table(report.byStage, "stage");
  table(report.byFixLocus, "fix locus");

  if (report.fixQueue.length === 0) {
    console.log("\nNothing open.");
    return;
  }

  console.log("\nFix queue (most severe first, grouped by where the fix goes):\n");
  for (const group of report.fixQueue) {
    console.log(`${group.fixLocus} — ${group.label}`);
    for (const observation of group.observations) {
      console.log(`  [${observation.severity}] ${observation.id} ${observation.mode}`);
      console.log(`      ${observation.source}`);
    }
    console.log("");
  }
}

main();
