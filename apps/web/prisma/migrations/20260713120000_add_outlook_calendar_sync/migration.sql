ALTER TABLE "MailboxConnection" ADD COLUMN "outlookCalendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MailboxConnection" ADD COLUMN "outlookCalendarId" TEXT;
ALTER TABLE "MailboxConnection" ADD COLUMN "outlookCalendarName" TEXT;
ALTER TABLE "MailboxConnection" ADD COLUMN "calendarLastSyncedAt" TIMESTAMP(3);
ALTER TABLE "MailboxConnection" ADD COLUMN "calendarSyncError" TEXT;

CREATE TABLE "OutlookCalendarEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mailboxConnectionId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "outlookEventId" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourceStartAt" TIMESTAMP(3) NOT NULL,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutlookCalendarEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutlookCalendarEvent_mailboxConnectionId_sourceType_sourceId_key" ON "OutlookCalendarEvent"("mailboxConnectionId", "sourceType", "sourceId");
CREATE INDEX "OutlookCalendarEvent_userId_sourceStartAt_idx" ON "OutlookCalendarEvent"("userId", "sourceStartAt");
ALTER TABLE "OutlookCalendarEvent" ADD CONSTRAINT "OutlookCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutlookCalendarEvent" ADD CONSTRAINT "OutlookCalendarEvent_mailboxConnectionId_fkey" FOREIGN KEY ("mailboxConnectionId") REFERENCES "MailboxConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
