-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tenantName" TEXT,
    "tenantEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "orgId" TEXT,
    "tenantIdentityId" TEXT,
    "submittedByUserId" TEXT,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "preferredCurrency" TEXT NOT NULL DEFAULT 'usd',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'english',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "assignedVendorId" TEXT,
    "assignedVendorName" TEXT,
    "assignedVendorEmail" TEXT,
    "assignedVendorPhone" TEXT,
    "dispatchStatus" TEXT,
    "vendorScheduledStart" DATETIME,
    "vendorScheduledEnd" DATETIME,
    "reviewState" TEXT DEFAULT 'none',
    "reviewNote" TEXT,
    "autoFlag" TEXT,
    "autoFlaggedAt" DATETIME,
    "lastAutoAlertAt" DATETIME,
    "firstReviewedAt" DATETIME,
    "claimedAt" DATETIME,
    "claimedByUserId" TEXT,
    "slaBucket" TEXT DEFAULT 'standard',
    "triageTagsCsv" TEXT DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestTender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT,
    "note" TEXT,
    "sentAt" DATETIME,
    "awardedAt" DATETIME,
    "canceledAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RequestTender_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenderInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "message" TEXT,
    "scopeNote" TEXT,
    "bidAmountCents" INTEGER,
    "bidCurrency" TEXT,
    "availabilityNote" TEXT,
    "proposedStart" DATETIME,
    "proposedEnd" DATETIME,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" DATETIME,
    "respondedAt" DATETIME,
    "awardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenderInvite_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "RequestTender" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TenderInvite_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TenderInvite_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "categoriesCsv" TEXT DEFAULT '',
    "supportedLanguagesCsv" TEXT DEFAULT '',
    "supportedCurrenciesCsv" TEXT DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VendorDispatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT,
    "actorUserId" TEXT,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "scheduledStart" DATETIME,
    "scheduledEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorDispatchEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorDispatchEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorDispatchEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorDispatchLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tenderInviteId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorDispatchLink_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorDispatchLink_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorDispatchLink_tenderInviteId_fkey" FOREIGN KEY ("tenderInviteId") REFERENCES "TenderInvite" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenancePhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "dispatchEventId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tenant',
    "sourceLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenancePhoto_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenancePhoto_dispatchEventId_fkey" FOREIGN KEY ("dispatchEventId") REFERENCES "VendorDispatchEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'external',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RequestComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorUserId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'tenant_visible',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenantIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_invite',
    "verifiedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantIdentity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TenantIdentity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenantInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantIdentityId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "sentVia" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "TenantInvite_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenantOtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantIdentityId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
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
    CONSTRAINT "TenantOtpChallenge_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenantSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantIdentityId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "sessionSecretHash" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastSeenAt" DATETIME,
    "userAgent" TEXT,
    CONSTRAINT "TenantSession_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "totalCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pdfUrl" TEXT,
    "sentTo" TEXT,
    "sentAt" DATETIME,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillingDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billingDocumentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingEvent_billingDocumentId_fkey" FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillingEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_tenantIdentityId_idx" ON "MaintenanceRequest"("tenantIdentityId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_orgId_idx" ON "MaintenanceRequest"("orgId");

-- CreateIndex
CREATE INDEX "RequestTender_requestId_status_idx" ON "RequestTender"("requestId", "status");

-- CreateIndex
CREATE INDEX "TenderInvite_requestId_status_idx" ON "TenderInvite"("requestId", "status");

-- CreateIndex
CREATE INDEX "TenderInvite_vendorId_status_idx" ON "TenderInvite"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenderInvite_tenderId_vendorId_key" ON "TenderInvite"("tenderId", "vendorId");

-- CreateIndex
CREATE INDEX "Vendor_orgId_isActive_idx" ON "Vendor"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "VendorDispatchEvent_requestId_createdAt_idx" ON "VendorDispatchEvent"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendorDispatchLink_tokenHash_key" ON "VendorDispatchLink"("tokenHash");

-- CreateIndex
CREATE INDEX "VendorDispatchLink_requestId_vendorId_idx" ON "VendorDispatchLink"("requestId", "vendorId");

-- CreateIndex
CREATE INDEX "TenantIdentity_orgId_idx" ON "TenantIdentity"("orgId");

-- CreateIndex
CREATE INDEX "TenantIdentity_propertyId_idx" ON "TenantIdentity"("propertyId");

-- CreateIndex
CREATE INDEX "TenantIdentity_unitId_idx" ON "TenantIdentity"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantIdentity_orgId_phoneE164_unitId_key" ON "TenantIdentity"("orgId", "phoneE164", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvite_tokenHash_key" ON "TenantInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TenantInvite_tenantIdentityId_status_idx" ON "TenantInvite"("tenantIdentityId", "status");

-- CreateIndex
CREATE INDEX "TenantInvite_orgId_status_idx" ON "TenantInvite"("orgId", "status");

-- CreateIndex
CREATE INDEX "TenantOtpChallenge_tenantIdentityId_purpose_createdAt_idx" ON "TenantOtpChallenge"("tenantIdentityId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "TenantOtpChallenge_orgId_purpose_idx" ON "TenantOtpChallenge"("orgId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSession_sessionSecretHash_key" ON "TenantSession"("sessionSecretHash");

-- CreateIndex
CREATE INDEX "TenantSession_tenantIdentityId_revokedAt_idx" ON "TenantSession"("tenantIdentityId", "revokedAt");

-- CreateIndex
CREATE INDEX "TenantSession_orgId_idx" ON "TenantSession"("orgId");

-- CreateIndex
CREATE INDEX "BillingDocument_requestId_idx" ON "BillingDocument"("requestId");

-- CreateIndex
CREATE INDEX "BillingDocument_status_idx" ON "BillingDocument"("status");

-- CreateIndex
CREATE INDEX "BillingEvent_billingDocumentId_createdAt_idx" ON "BillingEvent"("billingDocumentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

