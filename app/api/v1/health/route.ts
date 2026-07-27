import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [systemCount, assessmentCount, chunkRows] = await Promise.all([
      prisma.aiSystem.count(),
      prisma.assessment.count(),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*) AS count FROM "RegulationChunk" WHERE embedding IS NOT NULL;'
      )
    ]);

    const regulationChunkCount = Number(chunkRows[0]?.count ?? 0n);

    return NextResponse.json({
      status: "ok",
      service: "evidencepack-ai",
      checks: {
        database: true,
        systems: systemCount,
        assessments: assessmentCount,
        regulationChunks: regulationChunkCount,
        retrievalReady: regulationChunkCount > 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        service: "evidencepack-ai",
        message: error instanceof Error ? error.message : "Health check failed"
      },
      { status: 503 }
    );
  }
}
