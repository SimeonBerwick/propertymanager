ALTER TABLE "AccountDeletionRequest"
ADD COLUMN "scheduledFor" TIMESTAMP(3);

UPDATE "AccountDeletionRequest" AS request
SET "scheduledFor" = CASE
  WHEN account."subscriptionStatus" = 'trialing' THEN request."requestedAt" + INTERVAL '1 day'
  WHEN account."subscriptionEndsAt" IS NOT NULL
    AND account."subscriptionEndsAt" > request."requestedAt"
    AND account."subscriptionEndsAt" < request."requestedAt" + INTERVAL '30 days'
    THEN account."subscriptionEndsAt"
  ELSE request."requestedAt" + INTERVAL '30 days'
END
FROM "User" AS account
WHERE request."userId" = account."id" AND request."scheduledFor" IS NULL;

UPDATE "AccountDeletionRequest"
SET "scheduledFor" = "requestedAt" + INTERVAL '30 days'
WHERE "scheduledFor" IS NULL;

ALTER TABLE "AccountDeletionRequest"
ALTER COLUMN "scheduledFor" SET NOT NULL;

ALTER TABLE "AccountDeletionRequest"
ADD COLUMN "canceledAt" TIMESTAMP(3);

CREATE INDEX "AccountDeletionRequest_status_scheduledFor_idx"
ON "AccountDeletionRequest"("status", "scheduledFor");
