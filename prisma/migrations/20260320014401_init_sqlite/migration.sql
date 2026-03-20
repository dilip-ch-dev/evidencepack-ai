-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AISystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "businessPurpose" TEXT NOT NULL,
    "deploymentStatus" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "modelProviderDetails" TEXT NOT NULL,
    "humanOversightDescription" TEXT NOT NULL,
    "intendedUsers" TEXT NOT NULL,
    "affectedStakeholders" TEXT NOT NULL,
    "riskCategory" TEXT NOT NULL,
    "versionReleaseIdentifier" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AISystem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionnaireSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "QuestionnaireSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Answer_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "AISystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemId" TEXT NOT NULL,
    "sectionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT,
    "sourceUrl" TEXT,
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvidenceItem_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "AISystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "QuestionnaireSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemId" TEXT NOT NULL,
    "sectionId" TEXT,
    "questionId" TEXT,
    "evidenceItemId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Gap_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "AISystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Gap_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "QuestionnaireSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Gap_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Gap_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outputPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "ExportJob_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "AISystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireSection_sectionKey_key" ON "QuestionnaireSection"("sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionKey_key" ON "Question"("questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_systemId_questionId_key" ON "Answer"("systemId", "questionId");
