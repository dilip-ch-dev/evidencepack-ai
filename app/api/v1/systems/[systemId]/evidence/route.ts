import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { EvidenceStatus, EvidenceType } from "@/lib/db-enums";
import { createEvidenceItem } from "@/lib/services/systems";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { systemId: string };
};

const evidenceBodySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  type: z.nativeEnum(EvidenceType).default(EvidenceType.URL),
  sourceUrl: z.string().trim().url().optional(),
  sectionKey: z.string().trim().optional(),
  sectionId: z.string().trim().optional(),
  owner: z.string().trim().min(1),
  status: z.nativeEnum(EvidenceStatus).default(EvidenceStatus.COMPLETE),
  lastReviewedDate: z.string().trim().optional()
});

export async function POST(request: Request, context: RouteContext) {
  const auth = requireApiKey(request);
  if (!auth.ok) {
    return auth.response;
  }

  const systemId = context.params.systemId;
  const system = await prisma.aiSystem.findUnique({ where: { id: systemId } });
  if (!system) {
    return NextResponse.json({ error: "System not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as unknown;
    const parsed = evidenceBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid evidence payload",
          message: parsed.error.issues[0]?.message || "Validation failed"
        },
        { status: 400 }
      );
    }

    if (parsed.data.type === EvidenceType.URL && !parsed.data.sourceUrl) {
      return NextResponse.json(
        { error: "URL evidence requires sourceUrl" },
        { status: 400 }
      );
    }

    const evidence = await createEvidenceItem({
      systemId,
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      owner: parsed.data.owner,
      status: parsed.data.status,
      sectionKey: parsed.data.sectionKey,
      sectionId: parsed.data.sectionId,
      sourceUrl: parsed.data.sourceUrl ?? null,
      lastReviewedAt: parsed.data.lastReviewedDate
        ? new Date(parsed.data.lastReviewedDate)
        : new Date()
    });

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create evidence",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
