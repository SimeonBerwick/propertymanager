DO $$ BEGIN
  CREATE TYPE "AccountPlan" AS ENUM ('growth', 'pro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingCadence" AS ENUM ('monthly', 'annual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "subscriptionPlan" "AccountPlan",
  ADD COLUMN IF NOT EXISTS "billingCadence" "BillingCadence",
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
