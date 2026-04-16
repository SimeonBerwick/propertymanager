-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN "firstReviewedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "claimedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
