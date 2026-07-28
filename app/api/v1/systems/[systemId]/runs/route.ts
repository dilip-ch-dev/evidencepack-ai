import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { systemId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const runs = await prisma.assessmentRun.findMany({
      where: { systemId: context.params.systemId },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return NextResponse.json({
      systemId: context.params.systemId,
      runs: runs.map((run) => ({
        id: run.id,
        status: run.status,
        stage: run.stage,
        latencyMs: run.latencyMs,
        scoringVersion: run.scoringVersion,
        corpusVersion: run.corpusVersion,
        retrievedCount: run.retrievedCount,
        droppedCitations: run.droppedCitations,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Assessment runs unavailable",
        message:
          error instanceof Error
            ? error.message
            : "AssessmentRun table may not be synced yet. Run npm run db:push."
      },
      { status: 503 }
    );
  }
}
