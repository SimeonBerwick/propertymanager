-- CreateTable
CREATE TABLE "VendorSkillTag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSkillTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSkillAssignment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "skillTagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSkillAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorSkillTag_organizationId_slug_key" ON "VendorSkillTag"("organizationId", "slug");
CREATE INDEX "VendorSkillTag_organizationId_label_idx" ON "VendorSkillTag"("organizationId", "label");
CREATE UNIQUE INDEX "VendorSkillAssignment_vendorId_skillTagId_key" ON "VendorSkillAssignment"("vendorId", "skillTagId");
CREATE INDEX "VendorSkillAssignment_skillTagId_createdAt_idx" ON "VendorSkillAssignment"("skillTagId", "createdAt");

-- AddForeignKey
ALTER TABLE "VendorSkillTag" ADD CONSTRAINT "VendorSkillTag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorSkillAssignment" ADD CONSTRAINT "VendorSkillAssignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorSkillAssignment" ADD CONSTRAINT "VendorSkillAssignment_skillTagId_fkey" FOREIGN KEY ("skillTagId") REFERENCES "VendorSkillTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
