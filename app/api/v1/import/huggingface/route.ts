import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { buildSystemCardFromHuggingFace } from "@/lib/huggingface";
import { importSystemCard } from "@/lib/services/systems";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireApiKey(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as { source?: unknown };
    const source = typeof body?.source === "string" ? body.source : "";
    if (!source.trim()) {
      return NextResponse.json(
        { error: "Invalid Hugging Face input", message: "Provide a Hugging Face URL or owner/model slug." },
        { status: 400 }
      );
    }

    const card = await buildSystemCardFromHuggingFace(source);
    const result = await importSystemCard(card);

    return NextResponse.json(
      {
        system: result.system,
        answersCreated: result.answersCreated,
        evidenceCreated: result.evidenceCreated,
        uiPath: `/systems/${result.system.id}`
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Hugging Face import failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
