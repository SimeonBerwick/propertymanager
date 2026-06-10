ALTER TABLE "User"
ADD COLUMN "dailyCsvExportEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dailyCsvExportLastSentAt" TIMESTAMP(3);
