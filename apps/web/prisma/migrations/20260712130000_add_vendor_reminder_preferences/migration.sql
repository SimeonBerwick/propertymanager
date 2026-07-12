ALTER TABLE "User" ADD COLUMN "vendorRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "vendorReminderEnabled" BOOLEAN,
  ADD COLUMN "lastVendorReminderAt" TIMESTAMP(3);

ALTER TABLE "TenderInvite" ADD COLUMN "lastVendorReminderAt" TIMESTAMP(3);
