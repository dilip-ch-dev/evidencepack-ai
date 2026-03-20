import { ExportFormat, ExportStatus } from "@/lib/db-enums";
import { NextResponse } from "next/server";
import { buildMarkdownPack } from "@/lib/export-pack";
import { recomputeGaps } from "@/lib/gaps";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: {
    systemId: string;
  };
};

export async function GET(_request: Request, { params }: RouteProps) {
  await recomputeGaps(params.systemId);
  const markdownPack = await buildMarkdownPack(params.systemId);

  if (!markdownPack) {
    return NextResponse.json({ error: "System not found." }, { status: 404 });
  }

  await prisma.exportJob.create({
    data: {
      systemId: params.systemId,
      format: ExportFormat.MARKDOWN,
      status: ExportStatus.COMPLETED,
      outputPath: markdownPack.fileName,
      finishedAt: new Date()
    }
  });

  return new Response(markdownPack.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${markdownPack.fileName}"`
    }
  });
}
