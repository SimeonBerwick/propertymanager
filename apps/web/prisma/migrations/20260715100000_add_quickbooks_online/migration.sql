CREATE TABLE "QuickBooksConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "companyName" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "status" TEXT NOT NULL DEFAULT 'connected',
    "accessTokenCipher" TEXT NOT NULL,
    "refreshTokenCipher" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "referenceMode" TEXT NOT NULL DEFAULT 'customer',
    "vendorExpenseAccountId" TEXT,
    "vendorExpenseAccountName" TEXT,
    "tenantIncomeItemId" TEXT,
    "tenantIncomeItemName" TEXT,
    "staffLaborExpenseAccountId" TEXT,
    "staffLaborExpenseAccountName" TEXT,
    "staffMaterialExpenseAccountId" TEXT,
    "staffMaterialExpenseAccountName" TEXT,
    "staffOffsetAccountId" TEXT,
    "staffOffsetAccountName" TEXT,
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuickBooksConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuickBooksSyncRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "billingDocumentId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "entityDocNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuickBooksSyncRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuickBooksEntityMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localType" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "quickBooksType" TEXT NOT NULL,
    "quickBooksId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuickBooksEntityMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuickBooksConnection_userId_key" ON "QuickBooksConnection"("userId");
CREATE INDEX "QuickBooksConnection_realmId_status_idx" ON "QuickBooksConnection"("realmId", "status");
CREATE UNIQUE INDEX "QuickBooksSyncRecord_userId_sourceType_sourceId_key" ON "QuickBooksSyncRecord"("userId", "sourceType", "sourceId");
CREATE INDEX "QuickBooksSyncRecord_requestId_status_idx" ON "QuickBooksSyncRecord"("requestId", "status");
CREATE INDEX "QuickBooksSyncRecord_billingDocumentId_idx" ON "QuickBooksSyncRecord"("billingDocumentId");
CREATE UNIQUE INDEX "QuickBooksEntityMapping_userId_localType_localId_quickBooksType_key" ON "QuickBooksEntityMapping"("userId", "localType", "localId", "quickBooksType");
CREATE INDEX "QuickBooksEntityMapping_userId_quickBooksType_idx" ON "QuickBooksEntityMapping"("userId", "quickBooksType");
ALTER TABLE "QuickBooksConnection" ADD CONSTRAINT "QuickBooksConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuickBooksSyncRecord" ADD CONSTRAINT "QuickBooksSyncRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuickBooksSyncRecord" ADD CONSTRAINT "QuickBooksSyncRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuickBooksSyncRecord" ADD CONSTRAINT "QuickBooksSyncRecord_billingDocumentId_fkey" FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuickBooksEntityMapping" ADD CONSTRAINT "QuickBooksEntityMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
