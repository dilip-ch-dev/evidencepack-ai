import { NextResponse } from "next/server";
import { CURRENT_CORPUS_VERSION, CURRENT_SCORING_VERSION } from "@/lib/obligations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [systemCount, assessmentCount, chunkRows, runCount] = await Promise.all([
      prisma.aiSystem.count(),
      prisma.assessment.count(),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*) AS count FROM "RegulationChunk" WHERE embedding IS NOT NULL;'
      ),
      prisma.assessmentRun.count().catch(() => 0)
    ]);

    const regulationChunkCount = Number(chunkRows[0]?.count ?? 0n);

    return NextResponse.json({
      status: "ok",
      service: "truecite",
      versions: {
        scoring: CURRENT_SCORING_VERSION,
        corpus: CURRENT_CORPUS_VERSION
      },
      checks: {
        database: true,
        systems: systemCount,
        assessments: assessmentCount,
        assessmentRuns: runCount,
        regulationChunks: regulationChunkCount,
        retrievalReady: regulationChunkCount > 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        service: "truecite",
        message: error instanceof Error ? error.message : "Health check failed"
      },
      { status: 503 }
    );
  }
}
