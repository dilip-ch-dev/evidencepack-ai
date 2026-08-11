import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedSystem } from "@/lib/authorization";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { systemId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireOwnedSystem(context.params.systemId);
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
  } catch {
    return NextResponse.json(
      {
        error: "Assessment runs unavailable",
        message: "The resource was not found or is temporarily unavailable."
      },
      { status: 404 }
    );
  }
}
