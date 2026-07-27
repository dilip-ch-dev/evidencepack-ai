import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { createAiSystem, listSystemsSummary } from "@/lib/services/systems";
import { createSystemSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const systems = await listSystemsSummary();
    return NextResponse.json({ systems });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to list systems",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = requireApiKey(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as unknown;
    const parsed = createSystemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid system payload",
          message: parsed.error.issues[0]?.message || "Validation failed"
        },
        { status: 400 }
      );
    }

    const system = await createAiSystem(parsed.data);
    return NextResponse.json({ system }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create system",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
