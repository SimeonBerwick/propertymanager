-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('requested', 'approved', 'declined', 'vendor_selected', 'scheduled', 'in_progress', 'completed', 'closed', 'canceled', 'reopened');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CurrencyOption" AS ENUM ('usd', 'peso', 'pound', 'euro');

-- CreateEnum
CREATE TYPE "LanguageOption" AS ENUM ('english', 'spanish', 'french');

-- CreateEnum
CREATE TYPE "TenantIdentityStatus" AS ENUM ('pending_invite', 'active', 'inactive', 'moved_out');

-- CreateEnum
CREATE TYPE "TenantInviteStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "TenantOtpPurpose" AS ENUM ('invite_login', 'returning_login');

-- CreateEnum
CREATE TYPE "TenantOtpChannel" AS ENUM ('sms', 'email');

-- CreateEnum
CREATE TYPE "TenantEventVisibility" AS ENUM ('internal', 'tenant_visible');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('assigned', 'contacted', 'accepted', 'scheduled', 'in_progress', 'completed', 'declined', 'canceled');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('none', 'needs_follow_up', 'vendor_update_pending_review', 'vendor_completed_pending_review', 'reassignment_needed', 'vendor_declined_reassignment_needed', 'approved', 'reopened_after_review');

-- CreateEnum
CREATE TYPE "TenantBillbackDecision" AS ENUM ('none', 'bill_tenant', 'waived');

-- CreateEnum
CREATE TYPE "BidSource" AS ENUM ('vendor_submitted', 'manager_entered');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('open', 'awarded', 'canceled', 'closed');

-- CreateEnum
CREATE TYPE "TenderInviteStatus" AS ENUM ('invited', 'viewed', 'declined', 'bid_submitted', 'withdrawn', 'awarded', 'not_awarded');

-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('tenant', 'landlord', 'vendor');

-- CreateEnum
CREATE TYPE "BillingRecipientType" AS ENUM ('tenant', 'vendor');

-- CreateEnum
CREATE TYPE "BillingDocumentType" AS ENUM ('tenant_invoice', 'vendor_remittance');

-- CreateEnum
CREATE TYPE "BillingDocumentStatus" AS ENUM ('draft', 'sent', 'partial', 'paid', 'void');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tenantName" TEXT,
    "tenantEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "orgId" TEXT,
    "tenantIdentityId" TEXT,
    "submittedByUserId" TEXT,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "preferredCurrency" "CurrencyOption" NOT NULL DEFAULT 'usd',
    "preferredLanguage" "LanguageOption" NOT NULL DEFAULT 'english',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'requested',
    "assignedVendorId" TEXT,
    "assignedVendorName" TEXT,
    "assignedVendorEmail" TEXT,
    "assignedVendorPhone" TEXT,
    "dispatchStatus" "DispatchStatus",
    "vendorScheduledStart" TIMESTAMP(3),
    "vendorScheduledEnd" TIMESTAMP(3),
    "reviewState" "ReviewStatus" NOT NULL DEFAULT 'none',
    "reviewNote" TEXT,
    "declineReason" TEXT,
    "actualCompletedAt" TIMESTAMP(3),
    "tenantBillbackDecision" "TenantBillbackDecision" NOT NULL DEFAULT 'none',
    "tenantBillbackAmountCents" INTEGER NOT NULL DEFAULT 0,
    "tenantBillbackReason" TEXT,
    "tenantBillbackDecidedAt" TIMESTAMP(3),
    "tenantBillbackDecidedByUserId" TEXT,
    "canceledByType" TEXT,
    "canceledByUserId" TEXT,
    "cancelReason" TEXT,
    "reopenedReason" TEXT,
    "autoFlag" TEXT,
    "autoFlaggedAt" TIMESTAMP(3),
    "lastAutoAlertAt" TIMESTAMP(3),
    "firstReviewedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,
    "slaBucket" TEXT DEFAULT 'standard',
    "triageTagsCsv" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestTender" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "TenderStatus" NOT NULL DEFAULT 'open',
    "title" TEXT,
    "note" TEXT,
    "sentAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestTender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderInvite" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "TenderInviteStatus" NOT NULL DEFAULT 'invited',
    "message" TEXT,
    "scopeNote" TEXT,
    "bidAmountCents" INTEGER,
    "bidCurrency" "CurrencyOption",
    "bidSource" "BidSource",
    "availabilityNote" TEXT,
    "proposedStart" TIMESTAMP(3),
    "proposedEnd" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "categoriesCsv" TEXT DEFAULT '',
    "supportedLanguagesCsv" TEXT DEFAULT '',
    "supportedCurrenciesCsv" TEXT DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDispatchEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT,
    "actorUserId" TEXT,
    "status" "DispatchStatus" NOT NULL,
    "note" TEXT,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorDispatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDispatchLink" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tenderInviteId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorDispatchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePhoto" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "dispatchEventId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "source" "PhotoSource" NOT NULL DEFAULT 'tenant',
    "sourceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenancePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'external',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "actorUserId" TEXT,
    "visibility" "TenantEventVisibility" NOT NULL DEFAULT 'tenant_visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantIdentity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "email" TEXT,
    "status" "TenantIdentityStatus" NOT NULL DEFAULT 'pending_invite',
    "verifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvite" (
    "id" TEXT NOT NULL,
    "tenantIdentityId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "TenantInviteStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentVia" "TenantOtpChannel" NOT NULL,
    "sentTo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TenantInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantOtpChallenge" (
    "id" TEXT NOT NULL,
    "tenantIdentityId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "purpose" "TenantOtpPurpose" NOT NULL,
    "channel" "TenantOtpChannel" NOT NULL,
    "destinationMasked" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedUntil" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSession" (
    "id" TEXT NOT NULL,
    "tenantIdentityId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "sessionSecretHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "userAgent" TEXT,

    CONSTRAINT "TenantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "recipientType" "BillingRecipientType" NOT NULL,
    "documentType" "BillingDocumentType" NOT NULL,
    "status" "BillingDocumentStatus" NOT NULL DEFAULT 'draft',
    "currency" "CurrencyOption" NOT NULL DEFAULT 'usd',
    "totalCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pdfUrl" TEXT,
    "sentTo" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "billingDocumentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantBillbackDecidedByUserId_fkey" FOREIGN KEY ("tenantBillbackDecidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestTender" ADD CONSTRAINT "RequestTender_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderInvite" ADD CONSTRAINT "TenderInvite_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "RequestTender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderInvite" ADD CONSTRAINT "TenderInvite_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderInvite" ADD CONSTRAINT "TenderInvite_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDispatchEvent" ADD CONSTRAINT "VendorDispatchEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDispatchEvent" ADD CONSTRAINT "VendorDispatchEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDispatchEvent" ADD CONSTRAINT "VendorDispatchEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDispatchLink" ADD CONSTRAINT "VendorDispatchLink_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDispatchLink" ADD CONSTRAINT "VendorDispatchLink_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDispatchLink" ADD CONSTRAINT "VendorDispatchLink_tenderInviteId_fkey" FOREIGN KEY ("tenderInviteId") REFERENCES "TenderInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_dispatchEventId_fkey" FOREIGN KEY ("dispatchEventId") REFERENCES "VendorDispatchEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestComment" ADD CONSTRAINT "RequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestComment" ADD CONSTRAINT "RequestComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantIdentity" ADD CONSTRAINT "TenantIdentity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantIdentity" ADD CONSTRAINT "TenantIdentity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantOtpChallenge" ADD CONSTRAINT "TenantOtpChallenge_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSession" ADD CONSTRAINT "TenantSession_tenantIdentityId_fkey" FOREIGN KEY ("tenantIdentityId") REFERENCES "TenantIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_billingDocumentId_fkey" FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

