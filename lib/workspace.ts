import { prisma } from "@/lib/prisma";
import { getSessionIdHash } from "@/lib/session";

export const DEMO_WORKSPACE_ID = "sample-workspace-id";

export async function getPrimaryWorkspace() {
  const sessionIdHash = getSessionIdHash();
  return prisma.workspace.findUnique({ where: { sessionIdHash } });
}

export async function getOrCreatePrimaryWorkspace() {
  const sessionIdHash = getSessionIdHash();
  const existingWorkspace = await getPrimaryWorkspace();

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const email = `session-${sessionIdHash.slice(0, 24)}@truecite.local`;
  const owner = await prisma.user.upsert({
    where: { email },
    update: { name: "Private Session Owner" },
    create: {
      email,
      name: "Private Session Owner"
    }
  });

  return prisma.workspace.upsert({
    where: { sessionIdHash },
    update: {},
    create: {
      name: "Private TrueCite Workspace",
      ownerId: owner.id,
      sessionIdHash
    }
  });
}
