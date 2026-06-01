DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MailboxProvider') THEN
    CREATE TYPE "MailboxProvider" AS ENUM ('gmail', 'outlook');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MailboxConnectionStatus') THEN
    CREATE TYPE "MailboxConnectionStatus" AS ENUM ('connected', 'needs_reauth', 'disconnected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailDeliveryStatus') THEN
    CREATE TYPE "EmailDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'received', 'ignored');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MailboxConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" "MailboxProvider" NOT NULL,
  "status" "MailboxConnectionStatus" NOT NULL DEFAULT 'connected',
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "providerAccountId" TEXT,
  "accessTokenCipher" TEXT,
  "refreshTokenCipher" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopesCsv" TEXT DEFAULT '',
  "syncCursor" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "syncError" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailboxConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "OutboundEmail" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "requestId" TEXT,
  "mailboxConnectionId" TEXT,
  "provider" "MailboxProvider",
  "transport" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'pending',
  "to" TEXT NOT NULL,
  "from" TEXT,
  "subject" TEXT NOT NULL,
  "messageIdHeader" TEXT,
  "providerMessageId" TEXT,
  "providerThreadId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "OutboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OutboundEmail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OutboundEmail_mailboxConnectionId_fkey" FOREIGN KEY ("mailboxConnectionId") REFERENCES "MailboxConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InboundEmail" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "requestId" TEXT,
  "mailboxConnectionId" TEXT NOT NULL,
  "provider" "MailboxProvider" NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'received',
  "from" TEXT NOT NULL,
  "to" TEXT,
  "subject" TEXT NOT NULL,
  "textBody" TEXT,
  "htmlBody" TEXT,
  "providerMessageId" TEXT NOT NULL,
  "providerThreadId" TEXT,
  "messageIdHeader" TEXT,
  "inReplyToHeader" TEXT,
  "receivedAt" TIMESTAMP(3),
  "commentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InboundEmail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InboundEmail_mailboxConnectionId_fkey" FOREIGN KEY ("mailboxConnectionId") REFERENCES "MailboxConnection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InboundEmail_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "RequestComment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MailboxConnection_userId_provider_key" ON "MailboxConnection"("userId", "provider");
CREATE INDEX IF NOT EXISTS "MailboxConnection_userId_status_idx" ON "MailboxConnection"("userId", "status");
CREATE INDEX IF NOT EXISTS "OutboundEmail_userId_createdAt_idx" ON "OutboundEmail"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundEmail_requestId_createdAt_idx" ON "OutboundEmail"("requestId", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundEmail_providerMessageId_idx" ON "OutboundEmail"("providerMessageId");
CREATE INDEX IF NOT EXISTS "OutboundEmail_messageIdHeader_idx" ON "OutboundEmail"("messageIdHeader");
CREATE UNIQUE INDEX IF NOT EXISTS "InboundEmail_provider_providerMessageId_key" ON "InboundEmail"("provider", "providerMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "InboundEmail_commentId_key" ON "InboundEmail"("commentId");
CREATE INDEX IF NOT EXISTS "InboundEmail_userId_createdAt_idx" ON "InboundEmail"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "InboundEmail_requestId_createdAt_idx" ON "InboundEmail"("requestId", "createdAt");
CREATE INDEX IF NOT EXISTS "InboundEmail_providerThreadId_idx" ON "InboundEmail"("providerThreadId");
