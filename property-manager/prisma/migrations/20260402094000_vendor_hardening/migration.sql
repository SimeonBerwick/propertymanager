-- AlterTable
ALTER TABLE "Region" ADD COLUMN "preferredVendorId" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VendorRegionAssignment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorRegionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Region_preferredVendorId_idx" ON "Region"("preferredVendorId");

-- CreateIndex
CREATE INDEX "Vendor_organizationId_isActive_isAvailable_deletedAt_idx" ON "Vendor"("organizationId", "isActive", "isAvailable", "deletedAt");

-- CreateIndex
CREATE INDEX "VendorRegionAssignment_regionId_createdAt_idx" ON "VendorRegionAssignment"("regionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendorRegionAssignment_vendorId_regionId_key" ON "VendorRegionAssignment"("vendorId", "regionId");

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRegionAssignment" ADD CONSTRAINT "VendorRegionAssignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRegionAssignment" ADD CONSTRAINT "VendorRegionAssignment_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
