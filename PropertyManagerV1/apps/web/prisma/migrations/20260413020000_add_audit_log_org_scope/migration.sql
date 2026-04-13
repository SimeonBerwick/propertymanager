ALTER TABLE "AuditLog" ADD COLUMN "orgId" TEXT;

CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

UPDATE "AuditLog"
SET "orgId" = "actorUserId"
WHERE "orgId" IS NULL AND "actorUserId" IS NOT NULL;
