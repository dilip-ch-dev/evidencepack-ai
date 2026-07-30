import "dotenv/config";
import { formatDiff } from "@/lib/assessment-diff";
import { diffByIds, diffLatestForSystem } from "@/lib/assessment-history";
import { prisma } from "@/lib/prisma";

/**
 * Compares two assessments and reports what moved and what is responsible.
 *
 *   npm run diff -- <systemId>                 compare the two most recent
 *   npm run diff -- <beforeId> <afterId>       compare two specific assessments
 *   npm run diff -- <systemId> --json          machine-readable output
 */

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--json");
  const asJson = process.argv.includes("--json");

  if (args.length === 0) {
    console.error("Usage: npm run diff -- <systemId> | <beforeAssessmentId> <afterAssessmentId>");
    process.exitCode = 1;
    return;
  }

  const outcome =
    args.length >= 2 ? await diffByIds(args[0], args[1]) : await diffLatestForSystem(args[0]);

  if (outcome.status !== "ok") {
    console.error(outcome.message);
    process.exitCode = 1;
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(outcome.diff, null, 2));
    return;
  }

  for (const line of formatDiff(outcome.diff)) {
    console.log(line);
  }
}

main()
  .catch((error) => {
    console.error("Diff failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
