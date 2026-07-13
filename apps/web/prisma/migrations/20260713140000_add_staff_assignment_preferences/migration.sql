ALTER TABLE "User" ADD COLUMN "maintenanceDispatchDefault" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "User" ADD COLUMN "staffFallbackHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "User" ADD COLUMN "emergencyVendorFirst" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StaffMember" ADD COLUMN "maxOpenAssignments" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "assignmentPreferenceOverride" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "staffResponseDueAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "staffDeclinedAt" TIMESTAMP(3);

CREATE TABLE "MaintenanceAssignmentRule" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "propertyId" TEXT, "category" TEXT NOT NULL, "dispatchMode" TEXT NOT NULL,
  "preferredStaffId" TEXT, "preferredVendorId" TEXT, "fallbackHours" INTEGER NOT NULL DEFAULT 24,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MaintenanceAssignmentRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceAssignmentRule_orgId_propertyId_category_isActive_idx" ON "MaintenanceAssignmentRule"("orgId", "propertyId", "category", "isActive");
ALTER TABLE "MaintenanceAssignmentRule" ADD CONSTRAINT "MaintenanceAssignmentRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceAssignmentRule" ADD CONSTRAINT "MaintenanceAssignmentRule_preferredStaffId_fkey" FOREIGN KEY ("preferredStaffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceAssignmentRule" ADD CONSTRAINT "MaintenanceAssignmentRule_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
