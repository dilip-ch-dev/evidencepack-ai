import { NextResponse } from "next/server";
import { requireDemoResetKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Deletes non-sample AI systems from the primary demo workspace so public
 * demos stay clean. Requires DEMO_RESET_KEY.
 */
export async function POST(request: Request) {
  const auth = requireDemoResetKey(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const result = await prisma.aiSystem.deleteMany({
      where: {
        NOT: {
          systemName: {
            startsWith: "[SAMPLE DATA]"
          }
        }
      }
    });

    return NextResponse.json({
      deleted: result.count,
      message: "Non-sample systems removed. Re-run seed if the sample system is missing."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Demo reset failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
