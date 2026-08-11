import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import {
  generateAssessment,
  parseCitations,
  parseRecommendations
} from "@/lib/assessment";
import { prisma } from "@/lib/prisma";
import { requireOwnedSystem } from "@/lib/authorization";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = {
  params: { systemId: string };
};

export async function POST(request: Request, context: RouteContext) {
  const auth = requireApiKey(request);
  if (!auth.ok) {
    return auth.response;
  }

  const systemId = context.params.systemId;
  try {
    await requireOwnedSystem(systemId);
  } catch {
    return NextResponse.json({ error: "System not found" }, { status: 404 });
  }

  try {
    await enforceRateLimit("assessment", 5, 10 * 60 * 1000);
    const result = await generateAssessment(systemId);

    if (result.status === "error") {
      return NextResponse.json(
        {
          error: "Assessment failed",
          message: result.message,
          failure: result.failure ?? null
        },
        { status: 502 }
      );
    }

    const assessment = result.assessment;
    return NextResponse.json({
      status: result.status,
      message: result.message,
      assessment: assessment
        ? {
            id: assessment.id,
            score: assessment.score,
            level: assessment.level,
            summary: assessment.summary,
            confidence: assessment.confidence,
            recommendations: parseRecommendations(assessment.recommendations),
            citations: parseCitations(assessment.citations),
            createdAt: assessment.createdAt
          }
        : null
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    return NextResponse.json(
      {
        error: "Assessment failed",
        message: "An unexpected error occurred."
      },
      { status: 500 }
    );
  }
}
