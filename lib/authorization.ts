import { prisma } from "@/lib/prisma";
import { getOrCreatePrimaryWorkspace, DEMO_WORKSPACE_ID } from "@/lib/workspace";

export class ResourceNotFoundError extends Error {
  constructor() {
    super("Resource not found.");
    this.name = "ResourceNotFoundError";
  }
}

export async function requireOwnedSystem(systemId: string) {
  const workspace = await getOrCreatePrimaryWorkspace();
  const system = await prisma.aiSystem.findFirst({
    where: { id: systemId, workspaceId: workspace.id },
    select: { id: true, workspaceId: true }
  });
  if (!system) {
    throw new ResourceNotFoundError();
  }
  return system;
}

export async function getReadableSystemWorkspaceIds() {
  const workspace = await getOrCreatePrimaryWorkspace();
  return [workspace.id, DEMO_WORKSPACE_ID];
}
