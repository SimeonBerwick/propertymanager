-- Add first-class vendor offer negotiation status.

CREATE TYPE "VendorOfferStatus" AS ENUM (
  'NONE',
  'PENDING_REVIEW',
  'REVISION_REQUESTED',
  'ACCEPTED',
  'REJECTED'
);

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "vendorOfferStatus" "VendorOfferStatus" NOT NULL DEFAULT 'NONE';
