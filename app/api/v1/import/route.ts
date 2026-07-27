import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { importSystemCard } from "@/lib/services/systems";
import { parseSystemCard } from "@/lib/system-card";

export const dynamic = "force-dynamic";

/**
 * Import a system card (JSON or Markdown+YAML frontmatter) and create a full
 * AI system record with draft questionnaire answers and evidence links.
 */
export async function POST(request: Request) {
  const auth = requireApiKey(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let raw = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as unknown;
      if (typeof body === "string") {
        raw = body;
      } else if (body && typeof body === "object" && "content" in body) {
        const content = (body as { content?: unknown }).content;
        raw = typeof content === "string" ? content : JSON.stringify(body);
      } else {
        raw = JSON.stringify(body);
      }
    } else {
      raw = await request.text();
    }

    const parsed = parseSystemCard(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid system card", message: parsed.message }, { status: 400 });
    }

    const result = await importSystemCard(parsed.card);
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
        error: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
