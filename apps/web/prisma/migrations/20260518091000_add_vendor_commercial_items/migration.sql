CREATE TABLE "VendorCommercialItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orgId" TEXT,
    "itemType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "amountCents" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorCommercialItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorCommercialItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "VendorCommercialItem_requestId_submittedAt_idx" ON "VendorCommercialItem"("requestId", "submittedAt");
CREATE INDEX "VendorCommercialItem_vendorId_submittedAt_idx" ON "VendorCommercialItem"("vendorId", "submittedAt");
CREATE INDEX "VendorCommercialItem_orgId_submittedAt_idx" ON "VendorCommercialItem"("orgId", "submittedAt");
