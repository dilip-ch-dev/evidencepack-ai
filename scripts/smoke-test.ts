import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  type AssessmentFailure,
  generateAssessment,
  parseCitations,
  parseRecommendations
} from "@/lib/assessment";
import { normalizeClauseRef } from "@/lib/citations";

const SYSTEM_NAME = "[SAMPLE DATA] EU HR Screening Assistant";

type Check = { label: string; passed: boolean };
type FailureRecord = {
  run: number;
  stage: string;
  message: string;
  stack?: string;
};
const BETWEEN_RUN_DELAY_MS = 5000;

function fmtDistance(distance: number) {
  return Number.isFinite(distance) ? distance.toFixed(4) : String(distance);
}

function resolveRepeatCount() {
  const argValue = process.argv[2];
  const envValue = process.env.SMOKE_REPEAT_COUNT;
  const raw = argValue ?? envValue ?? "1";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function normalizeFailure(failure: AssessmentFailure | undefined, fallbackMessage: string) {
  return {
    stage: failure?.stage ?? "unknown",
    message: failure?.errorMessage ?? fallbackMessage,
    stack: failure?.stack
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const repeatCount = resolveRepeatCount();
  const checks: Check[] = [];
  console.log("=".repeat(72));
  console.log("EvidencePack AI — Grounded Assessment Smoke Test");
  console.log(`System under test: ${SYSTEM_NAME}`);
  console.log(`Repeat count: ${repeatCount}`);
  console.log("=".repeat(72));

  // 1. RegulationChunk row count.
  const chunkRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    'SELECT COUNT(*) AS count FROM "RegulationChunk" WHERE embedding IS NOT NULL;'
  );
  const chunkCount = Number(chunkRows[0]?.count ?? 0n);
  console.log(`\nRegulationChunk rows (non-null embedding): ${chunkCount}`);
  checks.push({ label: "chunks > 0", passed: chunkCount > 0 });

  // 2. Locate the seeded sample system.
  const system = await prisma.aiSystem.findFirst({
    where: { systemName: SYSTEM_NAME }
  });
  if (!system) {
    throw new Error(
      `Sample system not found by name: "${SYSTEM_NAME}". Run \`npm run db:seed\` first.`
    );
  }
  console.log(`Resolved system id: ${system.id}`);

  // 3. Run the full grounded assessment pipeline end-to-end (repeat mode).
  console.log("\nRunning generateAssessment() (embed -> retrieve -> generate -> parse -> persist)...");
  const failures: FailureRecord[] = [];
  let successCount = 0;
  let retrievalCheckPassed = true;
  let recommendationCitationCheckPassed = true;
  let groundedCitationCheckPassed = true;

  for (let run = 1; run <= repeatCount; run += 1) {
    const result = await generateAssessment(system.id);

    if (result.status !== "success") {
      const failure = normalizeFailure(result.failure, result.message);
      failures.push({
        run,
        stage: failure.stage,
        message: failure.message,
        stack: failure.stack
      });
      retrievalCheckPassed = false;
      recommendationCitationCheckPassed = false;
      groundedCitationCheckPassed = false;
    } else {
      successCount += 1;
      const { assessment } = result;
      const citations = parseCitations(assessment.citations);
      const recommendations = parseRecommendations(assessment.recommendations);
      const allowed = new Set(citations.map((citation) => normalizeClauseRef(citation.clauseRef)));

      if (run === repeatCount) {
        console.log("\nRetrieved clauses (clauseRef — distance) from latest successful run:");
        if (citations.length === 0) {
          console.log("  (none)");
        } else {
          for (const clause of citations) {
            console.log(
              `  - ${clause.clauseRef} — ${clause.title} [distance ${fmtDistance(clause.distance)}]`
            );
          }
        }

        console.log("\nAssessment output from latest successful run:");
        console.log(`  score:      ${assessment.score}`);
        console.log(`  level:      ${assessment.level}`);
        console.log(`  confidence: ${assessment.confidence ?? "(none)"}`);
        console.log(`  summary:    ${assessment.summary}`);

        console.log("\nRecommendations (clauseRef -> text) from latest successful run:");
        if (recommendations.length === 0) {
          console.log("  (none)");
        } else {
          recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. [${rec.clauseRef || "MISSING"}] ${rec.text}`);
          });
        }
      }

      retrievalCheckPassed = retrievalCheckPassed && citations.length >= 1;
      recommendationCitationCheckPassed =
        recommendationCitationCheckPassed &&
        recommendations.length > 0 &&
        recommendations.every(
          (rec) => typeof rec.clauseRef === "string" && rec.clauseRef.trim().length > 0
        );
      groundedCitationCheckPassed =
        groundedCitationCheckPassed &&
        recommendations.length > 0 &&
        recommendations.every((rec) => allowed.has(normalizeClauseRef(rec.clauseRef)));
    }

    if (run < repeatCount) {
      await sleep(BETWEEN_RUN_DELAY_MS);
    }
  }

  console.log(
    `\nRepeat summary: ${successCount} succeeded / ${failures.length} failed (total ${repeatCount})`
  );
  if (failures.length > 0) {
    console.log("\nFailure details:");
    for (const failure of failures) {
      console.log(`- Run ${failure.run}: stage=${failure.stage}`);
      console.log(`  message: ${failure.message}`);
      console.log(`  stack:\n${failure.stack ?? "(no stack provided)"}`);
    }
  }

  checks.push({ label: "assessment JSON parsed", passed: successCount === repeatCount });
  checks.push({ label: "retrieval returned >=1 clause", passed: retrievalCheckPassed });
  checks.push({
    label: "every recommendation has non-empty articleRef",
    passed: recommendationCitationCheckPassed
  });
  checks.push({
    label: "every recommendation citation ⊆ retrieved clauses",
    passed: groundedCitationCheckPassed
  });

  printSummary(checks);
}

function printSummary(checks: Check[]) {
  console.log("\n" + "-".repeat(72));
  console.log("CHECKS");
  console.log("-".repeat(72));
  for (const check of checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"}: ${check.label}`);
  }
  const allPassed = checks.every((check) => check.passed);
  console.log("-".repeat(72));
  console.log(allPassed ? "RESULT: PASS" : "RESULT: FAIL");
  if (!allPassed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("\nSMOKE TEST CRASHED");
    console.error(
      `Context: system="${SYSTEM_NAME}", model=${process.env.GEMINI_MODEL ?? "gemini-2.5-flash"}, embedModel=${process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001"}`
    );
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      console.error(error.stack ?? "(no stack)");
    } else {
      console.error("Non-Error thrown:", error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
