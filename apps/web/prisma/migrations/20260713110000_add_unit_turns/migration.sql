ALTER TABLE "User" ADD COLUMN "turnBoardStatusFilter" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "turnBoardPropertyFilter" TEXT;

CREATE TABLE "UnitTurnTemplate" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "name" TEXT NOT NULL, "tasksJson" TEXT NOT NULL,
  "defaultTargetDays" INTEGER NOT NULL DEFAULT 10, "requirePhotoForCompletion" BOOLEAN NOT NULL DEFAULT false,
  "requireNoteForCompletion" BOOLEAN NOT NULL DEFAULT false, "requireAllTasksForReady" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UnitTurnTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UnitTurn" (
  "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "unitId" TEXT NOT NULL, "templateId" TEXT, "title" TEXT NOT NULL,
  "templateName" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'planned', "moveOutAt" TIMESTAMP(3) NOT NULL,
  "targetMoveInAt" TIMESTAMP(3), "readyAt" TIMESTAMP(3), "requirePhotoForCompletion" BOOLEAN NOT NULL DEFAULT false,
  "requireNoteForCompletion" BOOLEAN NOT NULL DEFAULT false, "requireAllTasksForReady" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnitTurn_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UnitTurnTask" (
  "id" TEXT NOT NULL, "turnId" TEXT NOT NULL, "maintenanceRequestId" TEXT, "assignedVendorId" TEXT,
  "title" TEXT NOT NULL, "position" INTEGER NOT NULL, "expectedDays" INTEGER NOT NULL DEFAULT 1,
  "assignedType" TEXT NOT NULL DEFAULT 'manager', "status" TEXT NOT NULL DEFAULT 'not_started', "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "note" TEXT, "photoUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UnitTurnTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UnitTurnTemplate_orgId_isActive_idx" ON "UnitTurnTemplate"("orgId", "isActive");
CREATE INDEX "UnitTurn_orgId_status_targetMoveInAt_idx" ON "UnitTurn"("orgId", "status", "targetMoveInAt");
CREATE INDEX "UnitTurn_unitId_createdAt_idx" ON "UnitTurn"("unitId", "createdAt");
CREATE INDEX "UnitTurnTask_turnId_position_idx" ON "UnitTurnTask"("turnId", "position");
CREATE INDEX "UnitTurnTask_maintenanceRequestId_idx" ON "UnitTurnTask"("maintenanceRequestId");
CREATE INDEX "UnitTurnTask_assignedVendorId_status_idx" ON "UnitTurnTask"("assignedVendorId", "status");
ALTER TABLE "UnitTurn" ADD CONSTRAINT "UnitTurn_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UnitTurn" ADD CONSTRAINT "UnitTurn_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "UnitTurnTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnitTurnTask" ADD CONSTRAINT "UnitTurnTask_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "UnitTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnitTurnTask" ADD CONSTRAINT "UnitTurnTask_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnitTurnTask" ADD CONSTRAINT "UnitTurnTask_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
