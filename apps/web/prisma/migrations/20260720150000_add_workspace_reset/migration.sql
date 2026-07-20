ALTER TABLE "User"
ADD COLUMN "workspaceResetPendingAt" TIMESTAMP(3),
ADD COLUMN "workspaceResetScheduledFor" TIMESTAMP(3);

CREATE TABLE "WorkspaceResetRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "canceledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "WorkspaceResetRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceResetRequest_userId_status_idx"
ON "WorkspaceResetRequest"("userId", "status");

CREATE INDEX "WorkspaceResetRequest_status_scheduledFor_idx"
ON "WorkspaceResetRequest"("status", "scheduledFor");

ALTER TABLE "WorkspaceResetRequest"
ADD CONSTRAINT "WorkspaceResetRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
