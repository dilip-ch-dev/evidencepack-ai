-- Apply only after the approved production test-data wipe.
ALTER TABLE "Workspace" ADD COLUMN "sessionIdHash" TEXT;

CREATE UNIQUE INDEX "Workspace_sessionIdHash_key" ON "Workspace"("sessionIdHash");
CREATE UNIQUE INDEX "AISystem_workspaceId_systemName_key" ON "AISystem"("workspaceId", "systemName");

CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "sessionIdHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimitBucket_sessionIdHash_action_windowStartedAt_key"
ON "RateLimitBucket"("sessionIdHash", "action", "windowStartedAt");
CREATE INDEX "RateLimitBucket_windowStartedAt_idx" ON "RateLimitBucket"("windowStartedAt");
