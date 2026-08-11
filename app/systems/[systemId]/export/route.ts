import { NextResponse } from "next/server";
import { buildMarkdownPack } from "@/lib/export-pack";
import { requireOwnedSystem } from "@/lib/authorization";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: {
    systemId: string;
  };
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    await requireOwnedSystem(params.systemId);
  } catch {
    return NextResponse.json({ error: "System not found." }, { status: 404 });
  }
  const markdownPack = await buildMarkdownPack(params.systemId);

  if (!markdownPack) {
    return NextResponse.json({ error: "System not found." }, { status: 404 });
  }

  return new Response(markdownPack.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${markdownPack.fileName}"`
    }
  });
}
