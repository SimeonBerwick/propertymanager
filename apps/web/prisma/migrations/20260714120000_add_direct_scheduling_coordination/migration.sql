ALTER TABLE "User" ADD COLUMN "schedulingCoordinationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "schedulingAutoConfirmEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "schedulingWorkingHourStart" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "User" ADD COLUMN "schedulingWorkingHourEnd" INTEGER NOT NULL DEFAULT 18;
ALTER TABLE "User" ADD COLUMN "schedulingMinimumNoticeHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "User" ADD COLUMN "schedulingDefaultDurationMinutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "User" ADD COLUMN "schedulingProposalExpiryHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "schedulingCoordinationOverride" BOOLEAN;

CREATE TABLE "AppointmentProposal" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "proposedByType" TEXT NOT NULL,
  "proposedById" TEXT NOT NULL,
  "proposedByName" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentProposal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AppointmentProposal_requestId_status_createdAt_idx" ON "AppointmentProposal"("requestId", "status", "createdAt");
CREATE INDEX "AppointmentProposal_orgId_status_expiresAt_idx" ON "AppointmentProposal"("orgId", "status", "expiresAt");
CREATE INDEX "AppointmentProposal_batchId_idx" ON "AppointmentProposal"("batchId");
ALTER TABLE "AppointmentProposal" ADD CONSTRAINT "AppointmentProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentProposal" ADD CONSTRAINT "AppointmentProposal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
