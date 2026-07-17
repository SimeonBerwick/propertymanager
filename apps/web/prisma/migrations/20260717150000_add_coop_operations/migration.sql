ALTER TYPE "PropertyType" ADD VALUE IF NOT EXISTS 'cooperative';

CREATE TYPE "BoardApprovalStatus" AS ENUM ('pending', 'approved', 'returned', 'declined', 'overridden');
CREATE TYPE "RecurringWorkFrequency" AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual', 'custom_days');

ALTER TABLE "MaintenanceRequest"
ADD COLUMN "recurringWorkPlanId" TEXT,
ADD COLUMN "recurringDueAt" TIMESTAMP(3),
ADD COLUMN "boardApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "boardApprovalState" TEXT NOT NULL DEFAULT 'not_required',
ADD COLUMN "boardApprovalOverrideNote" TEXT;

ALTER TABLE "Vendor"
ADD COLUMN "insuranceCertificateExpiresAt" TIMESTAMP(3),
ADD COLUMN "insuranceCertificateReminderSentAt" TIMESTAMP(3),
ADD COLUMN "insuranceCertificateReference" TEXT;

CREATE TABLE "BoardApprover" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BoardApprover_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoardApprovalPolicy" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT,
  "approverId" TEXT,
  "category" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BoardApprovalPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringWorkPlan" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "urgency" "Urgency" NOT NULL DEFAULT 'medium',
  "frequency" "RecurringWorkFrequency" NOT NULL,
  "customIntervalDays" INTEGER,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "daysBeforeDue" INTEGER NOT NULL DEFAULT 14,
  "requiredEvidenceCsv" TEXT NOT NULL DEFAULT '',
  "preferredVendorId" TEXT,
  "requiresBoardApproval" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastGeneratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringWorkPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoardApproval" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "BoardApprovalStatus" NOT NULL DEFAULT 'pending',
  "responseNote" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardApprover_orgId_email_key" ON "BoardApprover"("orgId", "email");
CREATE INDEX "BoardApprover_orgId_isActive_idx" ON "BoardApprover"("orgId", "isActive");
CREATE INDEX "BoardApprovalPolicy_orgId_category_enabled_idx" ON "BoardApprovalPolicy"("orgId", "category", "enabled");
CREATE INDEX "BoardApprovalPolicy_propertyId_category_enabled_idx" ON "BoardApprovalPolicy"("propertyId", "category", "enabled");
CREATE INDEX "RecurringWorkPlan_orgId_isActive_nextDueAt_idx" ON "RecurringWorkPlan"("orgId", "isActive", "nextDueAt");
CREATE INDEX "RecurringWorkPlan_propertyId_isActive_idx" ON "RecurringWorkPlan"("propertyId", "isActive");
CREATE UNIQUE INDEX "BoardApproval_tokenHash_key" ON "BoardApproval"("tokenHash");
CREATE UNIQUE INDEX "BoardApproval_requestId_approverId_key" ON "BoardApproval"("requestId", "approverId");
CREATE INDEX "BoardApproval_requestId_status_idx" ON "BoardApproval"("requestId", "status");
CREATE INDEX "BoardApproval_approverId_status_idx" ON "BoardApproval"("approverId", "status");
CREATE INDEX "MaintenanceRequest_recurringDueAt_idx" ON "MaintenanceRequest"("recurringDueAt");

ALTER TABLE "BoardApprover" ADD CONSTRAINT "BoardApprover_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoardApprovalPolicy" ADD CONSTRAINT "BoardApprovalPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoardApprovalPolicy" ADD CONSTRAINT "BoardApprovalPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoardApprovalPolicy" ADD CONSTRAINT "BoardApprovalPolicy_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "BoardApprover"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringWorkPlan" ADD CONSTRAINT "RecurringWorkPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringWorkPlan" ADD CONSTRAINT "RecurringWorkPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringWorkPlan" ADD CONSTRAINT "RecurringWorkPlan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringWorkPlan" ADD CONSTRAINT "RecurringWorkPlan_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoardApproval" ADD CONSTRAINT "BoardApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoardApproval" ADD CONSTRAINT "BoardApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "BoardApprover"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_recurringWorkPlanId_fkey" FOREIGN KEY ("recurringWorkPlanId") REFERENCES "RecurringWorkPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
