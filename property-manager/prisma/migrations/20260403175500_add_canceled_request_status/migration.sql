-- Add canceled request status for bogus or invalid renter tickets.

ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";

CREATE TYPE "RequestStatus" AS ENUM (
  'NEW',
  'SCHEDULED',
  'IN_PROGRESS',
  'DONE',
  'CANCELED'
);

ALTER TABLE "MaintenanceRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RequestStatus"
  USING ("status"::text::"RequestStatus"),
  ALTER COLUMN "status" SET DEFAULT 'NEW';

DROP TYPE "RequestStatus_old";
