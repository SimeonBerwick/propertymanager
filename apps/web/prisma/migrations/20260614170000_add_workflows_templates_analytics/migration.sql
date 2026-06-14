CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "conditionField" TEXT NOT NULL,
  "conditionValue" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "actionValue" TEXT NOT NULL,
  "runCount" INTEGER NOT NULL DEFAULT 0,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequestTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "urgency" "Urgency" NOT NULL DEFAULT 'medium',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "eventName" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRule_orgId_enabled_idx" ON "AutomationRule"("orgId", "enabled");
CREATE INDEX "RequestTemplate_orgId_name_idx" ON "RequestTemplate"("orgId", "name");
CREATE INDEX "ProductEvent_orgId_eventName_createdAt_idx" ON "ProductEvent"("orgId", "eventName", "createdAt");
