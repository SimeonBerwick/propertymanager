-- Add final billing fields for vendor completion workflow.

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "vendorFinalBillCents" INTEGER,
  ADD COLUMN "vendorFinalTaxCents" INTEGER;
