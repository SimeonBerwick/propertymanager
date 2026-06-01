DO $$ BEGIN
  CREATE TYPE "AccountSubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "AccountSubscriptionStatus" NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMP(3);
