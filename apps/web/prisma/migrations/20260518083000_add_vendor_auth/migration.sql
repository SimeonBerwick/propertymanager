-- Add durable vendor auth primitives for V1.
ALTER TABLE "Vendor" ADD COLUMN "lastLoginAt" DATETIME;

CREATE TABLE "VendorSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "orgId" TEXT,
    "sessionSecretHash" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastSeenAt" DATETIME,
    "userAgent" TEXT,
    CONSTRAINT "VendorSession_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VendorSession_sessionSecretHash_key" ON "VendorSession"("sessionSecretHash");
CREATE INDEX "VendorSession_vendorId_revokedAt_idx" ON "VendorSession"("vendorId", "revokedAt");
CREATE INDEX "VendorSession_orgId_idx" ON "VendorSession"("orgId");

CREATE TABLE "VendorOtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "orgId" TEXT,
    "purpose" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destinationMasked" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedUntil" DATETIME,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorOtpChallenge_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "VendorOtpChallenge_vendorId_purpose_createdAt_idx" ON "VendorOtpChallenge"("vendorId", "purpose", "createdAt");
CREATE INDEX "VendorOtpChallenge_orgId_purpose_idx" ON "VendorOtpChallenge"("orgId", "purpose");
CREATE INDEX "Vendor_email_isActive_idx" ON "Vendor"("email", "isActive");
