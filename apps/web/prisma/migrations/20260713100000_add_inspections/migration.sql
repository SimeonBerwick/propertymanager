CREATE TABLE "InspectionTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "inspectionType" TEXT NOT NULL,
  "checklistJson" TEXT NOT NULL,
  "requirePhotoForIssues" BOOLEAN NOT NULL DEFAULT true,
  "requireNoteForIssues" BOOLEAN NOT NULL DEFAULT true,
  "includePhotosInReport" BOOLEAN NOT NULL DEFAULT true,
  "defaultDueDays" INTEGER NOT NULL DEFAULT 7,
  "reportTitle" TEXT NOT NULL DEFAULT 'Property inspection report',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Inspection" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "templateId" TEXT,
  "title" TEXT NOT NULL,
  "inspectionType" TEXT NOT NULL,
  "templateName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "requirePhotoForIssues" BOOLEAN NOT NULL DEFAULT true,
  "requireNoteForIssues" BOOLEAN NOT NULL DEFAULT true,
  "includePhotosInReport" BOOLEAN NOT NULL DEFAULT true,
  "reportTitle" TEXT NOT NULL DEFAULT 'Property inspection report',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionItem" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "maintenanceRequestId" TEXT,
  "section" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "result" TEXT NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "photoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InspectionTemplate_orgId_isActive_idx" ON "InspectionTemplate"("orgId", "isActive");
CREATE INDEX "Inspection_orgId_status_dueAt_idx" ON "Inspection"("orgId", "status", "dueAt");
CREATE INDEX "Inspection_unitId_createdAt_idx" ON "Inspection"("unitId", "createdAt");
CREATE INDEX "InspectionItem_inspectionId_position_idx" ON "InspectionItem"("inspectionId", "position");
CREATE INDEX "InspectionItem_maintenanceRequestId_idx" ON "InspectionItem"("maintenanceRequestId");
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
