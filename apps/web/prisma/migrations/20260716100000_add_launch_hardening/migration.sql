CREATE TABLE "ExternalOperation" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "orgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerObjectId" TEXT,
    "resultUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "orgId" TEXT,
    "principalType" TEXT,
    "principalId" TEXT,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "pagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalOperation_provider_operationType_operationKey_key" ON "ExternalOperation"("provider", "operationType", "operationKey");
CREATE INDEX "ExternalOperation_provider_status_updatedAt_idx" ON "ExternalOperation"("provider", "status", "updatedAt");
CREATE INDEX "ExternalOperation_orgId_createdAt_idx" ON "ExternalOperation"("orgId", "createdAt");
CREATE UNIQUE INDEX "SupportRequest_referenceId_key" ON "SupportRequest"("referenceId");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
CREATE INDEX "SupportRequest_orgId_createdAt_idx" ON "SupportRequest"("orgId", "createdAt");
CREATE INDEX "SupportRequest_email_createdAt_idx" ON "SupportRequest"("email", "createdAt");
