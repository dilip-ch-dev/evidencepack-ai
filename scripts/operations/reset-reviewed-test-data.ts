import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRMATION = "DELETE_TRUECITE_REVIEWED_TEST_DATA_20260811";
const REVIEWED_WORKSPACE_ID = "sample-workspace-id";
const REVIEWED_SYSTEM_IDS = [
  "cmn25waj5000zi9wf8335yo9j",
  "cms4ds4dy0001sl4veeiroxj7",
  "cms4egkeo00015o7nb0201suh",
  "cms82a3dp00017z9uhvobqetc",
  "cms82btn80001qabl2vgqj556",
] as const;

async function readAndAssertReviewedManifest() {
  const [users, workspaces, systems, counts, preserved] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true } }),
    prisma.workspace.findMany({ select: { id: true, ownerId: true } }),
    prisma.aiSystem.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    Promise.all([
      prisma.answer.count(),
      prisma.evidenceItem.count(),
      prisma.gap.count(),
      prisma.assessment.count(),
      prisma.assessmentRun.count(),
      prisma.exportJob.count(),
    ]),
    Promise.all([
      prisma.questionnaireSection.count(),
      prisma.question.count(),
      prisma.regulationChunk.count(),
    ]),
  ]);

  const actualSystemIds = systems.map(({ id }) => id).sort();
  const expectedSystemIds = [...REVIEWED_SYSTEM_IDS].sort();
  const expectedCounts = [55, 13, 43, 39, 5, 12];
  const isReviewedManifest =
    users.length === 1 &&
    users[0].email.toLowerCase().endsWith(".local") &&
    workspaces.length === 1 &&
    workspaces[0].id === REVIEWED_WORKSPACE_ID &&
    workspaces[0].ownerId === users[0].id &&
    JSON.stringify(actualSystemIds) === JSON.stringify(expectedSystemIds) &&
    JSON.stringify(counts) === JSON.stringify(expectedCounts);

  if (!isReviewedManifest) {
    throw new Error(
      "Production no longer matches the reviewed placeholder-data manifest; reset aborted.",
    );
  }

  return { userId: users[0].id, preserved };
}

async function main() {
  if (!process.argv.includes(`--confirm=${CONFIRMATION}`)) {
    throw new Error(`Missing required --confirm=${CONFIRMATION} argument.`);
  }

  const { userId, preserved } = await readAndAssertReviewedManifest();

  await prisma.$transaction(async (transaction) => {
    const deleted = await transaction.user.deleteMany({
      where: { id: userId, email: { endsWith: ".local", mode: "insensitive" } },
    });
    if (deleted.count !== 1) {
      throw new Error("Expected to delete exactly one reviewed placeholder user.");
    }
  });

  const [users, workspaces, systems, answers, evidenceItems, gaps, assessments, runs, exports] =
    await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.aiSystem.count(),
      prisma.answer.count(),
      prisma.evidenceItem.count(),
      prisma.gap.count(),
      prisma.assessment.count(),
      prisma.assessmentRun.count(),
      prisma.exportJob.count(),
    ]);
  const preservedAfter = await Promise.all([
    prisma.questionnaireSection.count(),
    prisma.question.count(),
    prisma.regulationChunk.count(),
  ]);

  if (
    [users, workspaces, systems, answers, evidenceItems, gaps, assessments, runs, exports].some(
      (count) => count !== 0,
    ) ||
    JSON.stringify(preservedAfter) !== JSON.stringify(preserved)
  ) {
    throw new Error("Post-reset verification failed.");
  }

  console.log(
    JSON.stringify({
      status: "reviewed-test-data-deleted",
      deleted: { users: 1, workspaces: 1, systems: REVIEWED_SYSTEM_IDS.length },
      preserved: {
        questionnaireSections: preservedAfter[0],
        questions: preservedAfter[1],
        regulationChunks: preservedAfter[2],
      },
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Reset failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
