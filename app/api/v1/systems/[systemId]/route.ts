import { NextResponse } from "next/server";
import { getSystemDetail } from "@/lib/services/systems";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { systemId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const system = await getSystemDetail(context.params.systemId);
    if (!system) {
      return NextResponse.json({ error: "System not found" }, { status: 404 });
    }
    return NextResponse.json({ system });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch system",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
