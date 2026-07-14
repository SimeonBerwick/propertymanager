ALTER TABLE "User" ALTER COLUMN "schedulingMinimumNoticeHours" SET DEFAULT 12;

UPDATE "User"
SET "schedulingMinimumNoticeHours" = 12
WHERE "schedulingMinimumNoticeHours" = 24;
