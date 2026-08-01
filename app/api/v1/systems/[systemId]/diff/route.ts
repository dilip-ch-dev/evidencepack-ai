import { NextResponse } from "next/server";
import { diffByIds, diffLatestForSystem } from "@/lib/assessment-history";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { systemId: string };
};

/**
 * Diffs two assessments for a system. Defaults to the two most recent; pass
 * `?before=<id>&after=<id>` to compare specific ones.
 */
export async function GET(request: Request, context: RouteContext) {
  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const after = searchParams.get("after");

  try {
    const outcome =
      before && after
        ? await diffByIds(before, after)
        : await diffLatestForSystem(context.params.systemId);

    if (outcome.status === "not_found") {
      return NextResponse.json({ error: "Not found", message: outcome.message }, { status: 404 });
    }
    if (outcome.status === "insufficient_history") {
      return NextResponse.json(
        { error: "Insufficient history", message: outcome.message },
        { status: 409 }
      );
    }

    return NextResponse.json({ systemId: context.params.systemId, diff: outcome.diff });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Diff unavailable",
        message: error instanceof Error ? error.message : "Failed to compute assessment diff."
      },
      { status: 503 }
    );
  }
}
