CREATE TABLE "NativePushToken" (
    "id" TEXT NOT NULL,
    "principalType" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NativePushToken_token_key" ON "NativePushToken"("token");
CREATE INDEX "NativePushToken_principalType_principalId_idx" ON "NativePushToken"("principalType", "principalId");
