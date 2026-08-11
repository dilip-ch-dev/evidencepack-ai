import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    users,
    workspaces,
    systems,
    answers,
    evidenceItems,
    gaps,
    assessments,
    assessmentRuns,
    exportJobs,
    questionnaireSections,
    questions,
    regulationChunks,
    rateLimitBuckets,
    migrations,
    demo,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.aiSystem.count(),
    prisma.answer.count(),
    prisma.evidenceItem.count(),
    prisma.gap.count(),
    prisma.assessment.count(),
    prisma.assessmentRun.count(),
    prisma.exportJob.count(),
    prisma.questionnaireSection.count(),
    prisma.question.count(),
    prisma.regulationChunk.count(),
    prisma.rateLimitBucket.count(),
    prisma.$queryRaw<Array<{ migration_name: string; finished: boolean }>>`
      SELECT migration_name, finished_at IS NOT NULL AS finished
      FROM "_prisma_migrations"
      ORDER BY migration_name
    `,
    prisma.workspace.findUnique({
      where: { id: "sample-workspace-id" },
      select: {
        sessionIdHash: true,
        systems: {
          select: {
            systemName: true,
            _count: {
              select: {
                answers: true,
                evidenceItems: true,
                gaps: true,
                assessments: true,
                assessmentRuns: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const state = {
    counts: {
      users,
      workspaces,
      systems,
      answers,
      evidenceItems,
      gaps,
      assessments,
      assessmentRuns,
      exportJobs,
      questionnaireSections,
      questions,
      regulationChunks,
      rateLimitBuckets,
    },
    demo: {
      exists: Boolean(demo),
      sessionHashIsNull: demo?.sessionIdHash === null,
      systems: demo?.systems ?? [],
    },
    migrations,
  };

  const valid =
    users === 1 &&
    workspaces === 1 &&
    systems === 1 &&
    answers === 10 &&
    evidenceItems === 2 &&
    assessments === 1 &&
    assessmentRuns === 1 &&
    exportJobs === 0 &&
    questionnaireSections === 11 &&
    questions === 11 &&
    regulationChunks === 12 &&
    rateLimitBuckets === 0 &&
    demo?.sessionIdHash === null &&
    demo.systems.length === 1 &&
    migrations.length === 2 &&
    migrations.every((migration) => migration.finished);

  console.log(JSON.stringify({ status: valid ? "verified" : "unexpected-state", ...state }));
  if (!valid) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Verification failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
