-- CreateEnum
CREATE TYPE "RequestTenderStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'DECLINED', 'AWARDED', 'NOT_AWARDED', 'CANCELED');

-- CreateTable
CREATE TABLE "RequestTender" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "status" "RequestTenderStatus" NOT NULL DEFAULT 'REQUESTED',
    "scopeOfWork" TEXT,
    "operatorNote" TEXT,
    "vendorNote" TEXT,
    "pricingType" "VendorPricingType" NOT NULL DEFAULT 'NONE',
    "priceCents" INTEGER,
    "plannedStartDate" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RequestTender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestTender_requestId_vendorId_key" ON "RequestTender"("requestId", "vendorId");
CREATE INDEX "RequestTender_vendorId_status_updatedAt_idx" ON "RequestTender"("vendorId", "status", "updatedAt");
CREATE INDEX "RequestTender_requestId_status_updatedAt_idx" ON "RequestTender"("requestId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "RequestTender" ADD CONSTRAINT "RequestTender_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestTender" ADD CONSTRAINT "RequestTender_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestTender" ADD CONSTRAINT "RequestTender_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one tender for already-assigned requests with commercial data.
INSERT INTO "RequestTender" (
  "id", "requestId", "vendorId", "status", "scopeOfWork", "pricingType", "priceCents",
  "plannedStartDate", "expectedCompletionDate", "requestedAt", "respondedAt", "decidedAt", "awardedAt", "createdAt", "updatedAt"
)
SELECT
  CONCAT('legacy_tender_', mr."id"),
  mr."id",
  mr."assignedVendorId",
  CASE WHEN mr."assignedVendorId" IS NOT NULL THEN 'AWARDED'::"RequestTenderStatus" ELSE 'REQUESTED'::"RequestTenderStatus" END,
  NULL,
  mr."vendorPricingType",
  mr."vendorPriceCents",
  mr."vendorPlannedStartDate",
  mr."vendorExpectedCompletionDate",
  mr."createdAt",
  mr."updatedAt",
  mr."updatedAt",
  mr."updatedAt",
  mr."createdAt",
  mr."updatedAt"
FROM "MaintenanceRequest" mr
WHERE mr."assignedVendorId" IS NOT NULL;
