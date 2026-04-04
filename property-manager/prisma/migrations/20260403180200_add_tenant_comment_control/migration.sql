-- Add per-ticket tenant comment access control.

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "tenantCommentsOpen" BOOLEAN NOT NULL DEFAULT true;
