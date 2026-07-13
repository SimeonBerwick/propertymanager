ALTER TYPE "PhotoSource" ADD VALUE 'staff';
ALTER TABLE "MaintenanceRequest" ADD COLUMN "assignedStaffId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "assignedStaffName" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "assignedStaffEmail" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "assignedStaffPhone" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "staffWorkStatus" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "staffScheduledStart" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "staffScheduledEnd" TIMESTAMP(3);

CREATE TABLE "StaffMember" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "phone" TEXT,
  "skillsCsv" TEXT DEFAULT '', "hourlyRateCents" INTEGER NOT NULL DEFAULT 0, "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
  "isActive" BOOLEAN NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StaffSession" (
  "id" TEXT NOT NULL, "staffMemberId" TEXT NOT NULL, "orgId" TEXT NOT NULL, "sessionSecretHash" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3), "userAgent" TEXT, CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StaffOtpChallenge" (
  "id" TEXT NOT NULL, "staffMemberId" TEXT NOT NULL, "orgId" TEXT NOT NULL, "destinationMasked" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL, "codeSalt" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5, "lockedUntil" TIMESTAMP(3), "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StaffOtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StaffWorkLog" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "staffMemberId" TEXT NOT NULL, "status" TEXT NOT NULL,
  "note" TEXT, "laborMinutes" INTEGER NOT NULL DEFAULT 0, "materialsCents" INTEGER NOT NULL DEFAULT 0,
  "photoUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StaffWorkLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffMember_orgId_isActive_idx" ON "StaffMember"("orgId", "isActive");
CREATE INDEX "StaffMember_email_isActive_idx" ON "StaffMember"("email", "isActive");
CREATE UNIQUE INDEX "StaffSession_sessionSecretHash_key" ON "StaffSession"("sessionSecretHash");
CREATE INDEX "StaffSession_staffMemberId_revokedAt_idx" ON "StaffSession"("staffMemberId", "revokedAt");
CREATE INDEX "StaffSession_orgId_idx" ON "StaffSession"("orgId");
CREATE INDEX "StaffOtpChallenge_staffMemberId_createdAt_idx" ON "StaffOtpChallenge"("staffMemberId", "createdAt");
CREATE INDEX "StaffOtpChallenge_orgId_createdAt_idx" ON "StaffOtpChallenge"("orgId", "createdAt");
CREATE INDEX "StaffWorkLog_requestId_createdAt_idx" ON "StaffWorkLog"("requestId", "createdAt");
CREATE INDEX "StaffWorkLog_staffMemberId_createdAt_idx" ON "StaffWorkLog"("staffMemberId", "createdAt");
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffOtpChallenge" ADD CONSTRAINT "StaffOtpChallenge_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffWorkLog" ADD CONSTRAINT "StaffWorkLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffWorkLog" ADD CONSTRAINT "StaffWorkLog_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
