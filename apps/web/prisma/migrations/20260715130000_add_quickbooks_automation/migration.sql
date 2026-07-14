ALTER TABLE "QuickBooksConnection"
ADD COLUMN "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

ALTER TABLE "QuickBooksSyncRecord"
ADD COLUMN "lastErrorAt" TIMESTAMP(3),
ADD COLUMN "nextRetryAt" TIMESTAMP(3);

CREATE INDEX "QuickBooksSyncRecord_status_nextRetryAt_idx"
ON "QuickBooksSyncRecord"("status", "nextRetryAt");
