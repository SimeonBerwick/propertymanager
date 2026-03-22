-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('new', 'scheduled', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tenantName" TEXT,
    "tenantEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "assignedVendorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePhoto" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenancePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'external',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestComment" ADD CONSTRAINT "RequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestComment" ADD CONSTRAINT "RequestComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

