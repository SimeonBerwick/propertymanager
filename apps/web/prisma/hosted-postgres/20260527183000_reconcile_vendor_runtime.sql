DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorCommercialType') THEN
    CREATE TYPE "VendorCommercialType" AS ENUM ('bid', 'service_fee', 'overcost', 'bill_to_property_manager');
  END IF;
END
$$;

ALTER TYPE "VendorCommercialType" ADD VALUE IF NOT EXISTS 'bid';
ALTER TYPE "VendorCommercialType" ADD VALUE IF NOT EXISTS 'service_fee';
ALTER TYPE "VendorCommercialType" ADD VALUE IF NOT EXISTS 'overcost';
ALTER TYPE "VendorCommercialType" ADD VALUE IF NOT EXISTS 'bill_to_property_manager';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorCommercialStatus') THEN
    CREATE TYPE "VendorCommercialStatus" AS ENUM ('submitted', 'approved', 'declined');
  END IF;
END
$$;

ALTER TYPE "VendorCommercialStatus" ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE "VendorCommercialStatus" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "VendorCommercialStatus" ADD VALUE IF NOT EXISTS 'declined';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorOtpPurpose') THEN
    CREATE TYPE "VendorOtpPurpose" AS ENUM ('returning_login', 'dispatch_link_login');
  END IF;
END
$$;

ALTER TYPE "VendorOtpPurpose" ADD VALUE IF NOT EXISTS 'returning_login';
ALTER TYPE "VendorOtpPurpose" ADD VALUE IF NOT EXISTS 'dispatch_link_login';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorOtpChannel') THEN
    CREATE TYPE "VendorOtpChannel" AS ENUM ('email');
  END IF;
END
$$;

ALTER TYPE "VendorOtpChannel" ADD VALUE IF NOT EXISTS 'email';

ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "VendorSession" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "orgId" TEXT,
  "sessionSecretHash" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "userAgent" TEXT,
  CONSTRAINT "VendorSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorSession_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "VendorSession_sessionSecretHash_key" ON "VendorSession"("sessionSecretHash");
CREATE INDEX IF NOT EXISTS "VendorSession_vendorId_revokedAt_idx" ON "VendorSession"("vendorId", "revokedAt");
CREATE INDEX IF NOT EXISTS "VendorSession_orgId_idx" ON "VendorSession"("orgId");

CREATE TABLE IF NOT EXISTS "VendorOtpChallenge" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "orgId" TEXT,
  "purpose" "VendorOtpPurpose" NOT NULL,
  "channel" "VendorOtpChannel" NOT NULL,
  "destinationMasked" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codeSalt" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lockedUntil" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorOtpChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorOtpChallenge_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VendorOtpChallenge_vendorId_purpose_createdAt_idx" ON "VendorOtpChallenge"("vendorId", "purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "VendorOtpChallenge_orgId_purpose_idx" ON "VendorOtpChallenge"("orgId", "purpose");
CREATE INDEX IF NOT EXISTS "Vendor_email_isActive_idx" ON "Vendor"("email", "isActive");

CREATE TABLE IF NOT EXISTS "VendorCommercialItem" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "orgId" TEXT,
  "itemType" "VendorCommercialType" NOT NULL,
  "status" "VendorCommercialStatus" NOT NULL DEFAULT 'submitted',
  "currency" "CurrencyOption" NOT NULL DEFAULT 'usd',
  "amountCents" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorCommercialItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorCommercialItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VendorCommercialItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VendorCommercialItem_requestId_submittedAt_idx" ON "VendorCommercialItem"("requestId", "submittedAt");
CREATE INDEX IF NOT EXISTS "VendorCommercialItem_vendorId_submittedAt_idx" ON "VendorCommercialItem"("vendorId", "submittedAt");
CREATE INDEX IF NOT EXISTS "VendorCommercialItem_orgId_submittedAt_idx" ON "VendorCommercialItem"("orgId", "submittedAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'VendorOtpChallenge'
      AND column_name = 'purpose'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "VendorOtpChallenge" ALTER COLUMN purpose TYPE "VendorOtpPurpose" USING purpose::"VendorOtpPurpose";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'VendorOtpChallenge'
      AND column_name = 'channel'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "VendorOtpChallenge" ALTER COLUMN channel TYPE "VendorOtpChannel" USING channel::"VendorOtpChannel";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'VendorCommercialItem'
      AND column_name = 'itemType'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "VendorCommercialItem" ALTER COLUMN "itemType" DROP DEFAULT;
    ALTER TABLE "VendorCommercialItem" ALTER COLUMN "itemType" TYPE "VendorCommercialType" USING "itemType"::"VendorCommercialType";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'VendorCommercialItem'
      AND column_name = 'status'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "VendorCommercialItem" ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE "VendorCommercialItem" ALTER COLUMN status TYPE "VendorCommercialStatus" USING status::"VendorCommercialStatus";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'VendorCommercialItem'
      AND column_name = 'currency'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "VendorCommercialItem" ALTER COLUMN currency DROP DEFAULT;
    ALTER TABLE "VendorCommercialItem" ALTER COLUMN currency TYPE "CurrencyOption" USING currency::"CurrencyOption";
  END IF;
END
$$;

ALTER TABLE "VendorCommercialItem"
  ALTER COLUMN status SET DEFAULT 'submitted'::"VendorCommercialStatus",
  ALTER COLUMN currency SET DEFAULT 'usd'::"CurrencyOption";
