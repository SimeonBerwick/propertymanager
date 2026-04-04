-- Add operator-controlled payment status and vendor additional-cost billing fields.

CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'HALF_DOWN', 'PAID_IN_FULL');

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "vendorAdditionalCostsCents" INTEGER,
  ADD COLUMN "vendorAdditionalTaxCents" INTEGER;
