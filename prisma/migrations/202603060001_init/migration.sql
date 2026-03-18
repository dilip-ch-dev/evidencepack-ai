-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PLANNED', 'PILOT', 'PRODUCTION', 'RETIRED');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('MINIMAL', 'LIMITED', 'HIGH', 'UNACCEPTABLE');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('FILE', 'URL');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('INCOMPLETE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "GapType" AS ENUM (
  'MISSING_REQUIRED_SECTION',
  'MISSING_EVIDENCE',
  'STALE_EVIDENCE',
  'UNANSWERED_QUESTION'
);

-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('MARKDOWN');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISystem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "systemName" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "businessPurpose" TEXT NOT NULL,
  "deploymentStatus" "DeploymentStatus" NOT NULL,
  "geography" TEXT NOT NULL,
  "modelProviderDetails" TEXT NOT NULL,
  "humanOversightDescription" TEXT NOT NULL,
  "intendedUsers" TEXT NOT NULL,
  "affectedStakeholders" TEXT NOT NULL,
  "riskCategory" "RiskCategory" NOT NULL,
  "versionReleaseIdentifier" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AISystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireSection" (
  "id" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL,

  CONSTRAINT "QuestionnaireSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
  "id" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
  "id" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "sectionId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "EvidenceType" NOT NULL,
  "filePath" TEXT,
  "sourceUrl" TEXT,
  "owner" TEXT NOT NULL,
  "status" "EvidenceStatus" NOT NULL,
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gap" (
  "id" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "sectionId" TEXT,
  "questionId" TEXT,
  "evidenceItemId" TEXT,
  "type" "GapType" NOT NULL,
  "status" "GapStatus" NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Gap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
  "id" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "format" "ExportFormat" NOT NULL,
  "status" "ExportStatus" NOT NULL,
  "outputPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireSection_sectionKey_key" ON "QuestionnaireSection"("sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionKey_key" ON "Question"("questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_systemId_questionId_key" ON "Answer"("systemId", "questionId");

-- AddForeignKey
ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_ownerId_fkey"
FOREIGN KEY ("ownerId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISystem"
ADD CONSTRAINT "AISystem_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question"
ADD CONSTRAINT "Question_sectionId_fkey"
FOREIGN KEY ("sectionId")
REFERENCES "QuestionnaireSection"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer"
ADD CONSTRAINT "Answer_systemId_fkey"
FOREIGN KEY ("systemId")
REFERENCES "AISystem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer"
ADD CONSTRAINT "Answer_questionId_fkey"
FOREIGN KEY ("questionId")
REFERENCES "Question"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem"
ADD CONSTRAINT "EvidenceItem_systemId_fkey"
FOREIGN KEY ("systemId")
REFERENCES "AISystem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem"
ADD CONSTRAINT "EvidenceItem_sectionId_fkey"
FOREIGN KEY ("sectionId")
REFERENCES "QuestionnaireSection"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap"
ADD CONSTRAINT "Gap_systemId_fkey"
FOREIGN KEY ("systemId")
REFERENCES "AISystem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap"
ADD CONSTRAINT "Gap_sectionId_fkey"
FOREIGN KEY ("sectionId")
REFERENCES "QuestionnaireSection"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap"
ADD CONSTRAINT "Gap_questionId_fkey"
FOREIGN KEY ("questionId")
REFERENCES "Question"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap"
ADD CONSTRAINT "Gap_evidenceItemId_fkey"
FOREIGN KEY ("evidenceItemId")
REFERENCES "EvidenceItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob"
ADD CONSTRAINT "ExportJob_systemId_fkey"
FOREIGN KEY ("systemId")
REFERENCES "AISystem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
