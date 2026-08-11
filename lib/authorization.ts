import { prisma } from "@/lib/prisma";
import { getPrimaryWorkspace, DEMO_WORKSPACE_ID } from "@/lib/workspace";

export class ResourceNotFoundError extends Error {
  constructor() {
    super("Resource not found.");
    this.name = "ResourceNotFoundError";
  }
}

export async function requireOwnedSystem(systemId: string) {
  const workspace = await getPrimaryWorkspace();
  if (!workspace) {
    throw new ResourceNotFoundError();
  }
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
  const workspace = await getPrimaryWorkspace();
  return workspace ? [workspace.id, DEMO_WORKSPACE_ID] : [DEMO_WORKSPACE_ID];
}
