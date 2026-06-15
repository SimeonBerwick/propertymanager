CREATE TYPE "ManagerAccessCodeRole" AS ENUM ('tenant', 'vendor');

ALTER TABLE "VendorSession" ADD COLUMN "requestId" TEXT;

CREATE INDEX "VendorSession_requestId_idx" ON "VendorSession"("requestId");

CREATE TABLE "ManagerAccessCode" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "role" "ManagerAccessCodeRole" NOT NULL,
    "tenantIdentityId" TEXT,
    "vendorId" TEXT,
    "propertyId" TEXT,
    "unitId" TEXT,
    "requestId" TEXT,
    "codeLookup" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedUntil" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerAccessCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManagerAccessCode_role_codeLookup_idx" ON "ManagerAccessCode"("role", "codeLookup");
CREATE INDEX "ManagerAccessCode_orgId_role_createdAt_idx" ON "ManagerAccessCode"("orgId", "role", "createdAt");
CREATE INDEX "ManagerAccessCode_tenantIdentityId_revokedAt_idx" ON "ManagerAccessCode"("tenantIdentityId", "revokedAt");
CREATE INDEX "ManagerAccessCode_vendorId_revokedAt_idx" ON "ManagerAccessCode"("vendorId", "revokedAt");
CREATE INDEX "ManagerAccessCode_requestId_revokedAt_idx" ON "ManagerAccessCode"("requestId", "revokedAt");
