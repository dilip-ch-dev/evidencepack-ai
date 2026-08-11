import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REVIEWED_WORKSPACE_ID = "sample-workspace-id";
const REVIEWED_SYSTEM_IDS = [
  "cmn25waj5000zi9wf8335yo9j",
  "cms4ds4dy0001sl4veeiroxj7",
  "cms4egkeo00015o7nb0201suh",
  "cms82a3dp00017z9uhvobqetc",
  "cms82btn80001qabl2vgqj556",
] as const;

function requireOutputPath() {
  const argument = process.argv.find((value) => value.startsWith("--output="));
  if (!argument) {
    throw new Error("Missing required --output=<absolute-json-path> argument.");
  }

  const outputPath = resolve(argument.slice("--output=".length));
  if (!outputPath.toLowerCase().endsWith(".json")) {
    throw new Error("Backup output must be a .json file.");
  }

  return outputPath;
}

async function assertReviewedManifest() {
  const [users, workspaces, systems] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    }),
    prisma.workspace.findMany({
      select: { id: true, name: true, ownerId: true, createdAt: true, updatedAt: true },
    }),
    prisma.aiSystem.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
  ]);

  const actualSystemIds = systems.map(({ id }) => id).sort();
  const expectedSystemIds = [...REVIEWED_SYSTEM_IDS].sort();
  const isReviewedManifest =
    users.length === 1 &&
    users[0].email.toLowerCase().endsWith(".local") &&
    workspaces.length === 1 &&
    workspaces[0].id === REVIEWED_WORKSPACE_ID &&
    workspaces[0].ownerId === users[0].id &&
    JSON.stringify(actualSystemIds) === JSON.stringify(expectedSystemIds);

  if (!isReviewedManifest) {
    throw new Error(
      "Production no longer matches the reviewed placeholder-data manifest; backup aborted.",
    );
  }

  return { users, workspaces };
}

async function main() {
  const outputPath = requireOutputPath();
  const manifest = await assertReviewedManifest();

  const [systems, answers, evidenceItems, gaps, assessments, assessmentRuns, exportJobs] =
    await Promise.all([
      prisma.aiSystem.findMany({ where: { workspaceId: REVIEWED_WORKSPACE_ID } }),
      prisma.answer.findMany({ where: { system: { workspaceId: REVIEWED_WORKSPACE_ID } } }),
      prisma.evidenceItem.findMany({ where: { system: { workspaceId: REVIEWED_WORKSPACE_ID } } }),
      prisma.gap.findMany({ where: { system: { workspaceId: REVIEWED_WORKSPACE_ID } } }),
      prisma.assessment.findMany({ where: { system: { workspaceId: REVIEWED_WORKSPACE_ID } } }),
      prisma.assessmentRun.findMany({ where: { system: { workspaceId: REVIEWED_WORKSPACE_ID } } }),
      prisma.exportJob.findMany({ where: { system: { workspaceId: REVIEWED_WORKSPACE_ID } } }),
    ]);

  const backup = {
    format: "truecite-reviewed-test-data-v1",
    createdAt: new Date().toISOString(),
    reviewedWorkspaceId: REVIEWED_WORKSPACE_ID,
    users: manifest.users,
    workspaces: manifest.workspaces,
    systems,
    answers,
    evidenceItems,
    gaps,
    assessments,
    assessmentRuns,
    exportJobs,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });

  console.log(
    JSON.stringify({
      status: "backup-created",
      outputPath,
      counts: {
        users: backup.users.length,
        workspaces: backup.workspaces.length,
        systems: backup.systems.length,
        answers: backup.answers.length,
        evidenceItems: backup.evidenceItems.length,
        gaps: backup.gaps.length,
        assessments: backup.assessments.length,
        assessmentRuns: backup.assessmentRuns.length,
        exportJobs: backup.exportJobs.length,
      },
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Backup failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
