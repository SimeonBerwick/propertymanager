CREATE TYPE "TrialProgram" AS ENUM ('none', 'self_service_30', 'assisted_us_30', 'legacy_promo');
CREATE TYPE "AssistedServiceStatus" AS ENUM ('not_included', 'pending', 'scheduled', 'completed', 'declined');

ALTER TABLE "User"
ADD COLUMN "trialProgram" "TrialProgram" NOT NULL DEFAULT 'none',
ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "trialSource" TEXT,
ADD COLUMN "trialReminder7SentAt" TIMESTAMP(3),
ADD COLUMN "trialReminder2SentAt" TIMESTAMP(3),
ADD COLUMN "consultationStatus" "AssistedServiceStatus" NOT NULL DEFAULT 'not_included',
ADD COLUMN "assistedImportStatus" "AssistedServiceStatus" NOT NULL DEFAULT 'not_included',
ADD COLUMN "businessCountryCode" TEXT,
ADD COLUMN "businessStateCode" TEXT;

UPDATE "User"
SET
  "trialProgram" = CASE
    WHEN "subscriptionStatus" = 'trialing' THEN 'self_service_30'::"TrialProgram"
    ELSE 'none'::"TrialProgram"
  END,
  "trialStartedAt" = CASE
    WHEN "subscriptionStatus" = 'trialing' THEN "createdAt"
    ELSE NULL
  END,
  "trialSource" = CASE
    WHEN "subscriptionStatus" = 'trialing' THEN 'legacy_signup'
    ELSE NULL
  END;

CREATE TABLE "LegalConsent" (
  "id" TEXT NOT NULL,
  "acceptanceKey" TEXT NOT NULL,
  "orgId" TEXT,
  "principalType" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "trialAgreementVersion" TEXT,
  "consentText" TEXT NOT NULL,
  "trialProgram" "TrialProgram",
  "subscriptionPlan" "AccountPlan",
  "billingCadence" "BillingCadence",
  "amountCents" INTEGER,
  "currencyCode" TEXT,
  "trialStartedAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalConsent_acceptanceKey_key" ON "LegalConsent"("acceptanceKey");
CREATE INDEX "LegalConsent_principalType_principalId_acceptedAt_idx" ON "LegalConsent"("principalType", "principalId", "acceptedAt");
CREATE INDEX "LegalConsent_orgId_acceptedAt_idx" ON "LegalConsent"("orgId", "acceptedAt");
CREATE INDEX "LegalConsent_context_acceptedAt_idx" ON "LegalConsent"("context", "acceptedAt");
