import { prisma } from "@/lib/prisma";

export async function getOrCreatePrimaryWorkspace() {
  const existingWorkspace = await prisma.workspace.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const owner = await prisma.user.upsert({
    where: { email: "local.owner@evidencepack.local" },
    update: { name: "Local Workspace Owner" },
    create: {
      email: "local.owner@evidencepack.local",
      name: "Local Workspace Owner"
    }
  });

  return prisma.workspace.create({
    data: {
      name: "Local EvidencePack Workspace",
      ownerId: owner.id
    }
  });
}
