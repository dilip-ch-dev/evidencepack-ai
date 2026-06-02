import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  generateAssessment,
  parseCitations,
  parseRecommendations
} from "@/lib/assessment";

const SYSTEM_NAME = "[SAMPLE DATA] EU HR Screening Assistant";

type Check = { label: string; passed: boolean };

function fmtDistance(distance: number) {
  return Number.isFinite(distance) ? distance.toFixed(4) : String(distance);
}

async function main() {
  const checks: Check[] = [];
  console.log("=".repeat(72));
  console.log("EvidencePack AI — Grounded Assessment Smoke Test");
  console.log(`System under test: ${SYSTEM_NAME}`);
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

  // 3. Run the full grounded assessment pipeline end-to-end.
  console.log("\nRunning generateAssessment() (embed -> retrieve -> generate -> persist)...");
  const result = await generateAssessment(system.id);
  const assessmentParsed = result.status === "success";
  checks.push({ label: "assessment JSON parsed", passed: assessmentParsed });

  if (result.status !== "success") {
    console.log(`Pipeline error: ${result.message}`);
    // Retrieval/recommendation checks cannot pass without a successful run.
    checks.push({ label: "retrieval returned >=1 clause", passed: false });
    checks.push({ label: "every recommendation has non-empty articleRef", passed: false });
    printSummary(checks);
    return;
  }

  const { assessment } = result;
  const citations = parseCitations(assessment.citations);
  const recommendations = parseRecommendations(assessment.recommendations);

  // 4. Retrieved clauses with articleRef + distance.
  console.log("\nRetrieved clauses (articleRef — distance):");
  if (citations.length === 0) {
    console.log("  (none)");
  } else {
    for (const clause of citations) {
      console.log(`  - ${clause.articleRef} — ${clause.title} [distance ${fmtDistance(clause.distance)}]`);
    }
  }
  checks.push({ label: "retrieval returned >=1 clause", passed: citations.length >= 1 });

  // 5. Generated score / level / confidence.
  console.log("\nAssessment output:");
  console.log(`  score:      ${assessment.score}`);
  console.log(`  level:      ${assessment.level}`);
  console.log(`  confidence: ${assessment.confidence ?? "(none)"}`);
  console.log(`  summary:    ${assessment.summary}`);

  // 6. Recommendations, each with its articleRef.
  console.log("\nRecommendations (articleRef -> text):");
  if (recommendations.length === 0) {
    console.log("  (none)");
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. [${rec.articleRef || "MISSING"}] ${rec.text}`);
    });
  }
  const everyRecHasArticleRef =
    recommendations.length > 0 &&
    recommendations.every((rec) => typeof rec.articleRef === "string" && rec.articleRef.trim().length > 0);
  checks.push({
    label: "every recommendation has non-empty articleRef",
    passed: everyRecHasArticleRef
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
    console.error(`Context: system="${SYSTEM_NAME}", model=${process.env.GEMINI_MODEL ?? "gemini-2.5-flash"}, embedModel=${process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001"}`);
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
