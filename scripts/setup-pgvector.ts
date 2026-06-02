import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector;");
  console.log("pgvector extension ensured (CREATE EXTENSION IF NOT EXISTS vector).");
}

main()
  .catch((error) => {
    console.error("Failed to enable pgvector extension:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
