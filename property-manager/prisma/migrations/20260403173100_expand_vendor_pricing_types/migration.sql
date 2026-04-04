-- Expand vendor pricing types to reflect actual commercial states.
-- PostgreSQL enum migration via text-cast swap to preserve existing data.

ALTER TYPE "VendorPricingType" RENAME TO "VendorPricingType_old";

CREATE TYPE "VendorPricingType" AS ENUM (
  'NONE',
  'ESTIMATE',
  'SERVICE_CALL_ONLY',
  'FIRM_BID',
  'LABOR_ONLY_COST'
);

ALTER TABLE "MaintenanceRequest"
  ALTER COLUMN "vendorPricingType" DROP DEFAULT,
  ALTER COLUMN "vendorPricingType" TYPE "VendorPricingType"
  USING (
    CASE
      WHEN "vendorPricingType"::text = 'FULL_BID' THEN 'FIRM_BID'
      WHEN "vendorPricingType"::text = 'INITIAL_SERVICE_FEE' THEN 'SERVICE_CALL_ONLY'
      ELSE "vendorPricingType"::text
    END
  )::"VendorPricingType",
  ALTER COLUMN "vendorPricingType" SET DEFAULT 'NONE';

DROP TYPE "VendorPricingType_old";
