-- CreateEnum
CREATE TYPE "CurrencyOption" AS ENUM ('usd', 'peso', 'pound', 'euro');

-- CreateEnum
CREATE TYPE "LanguageOption" AS ENUM ('english', 'spanish', 'french');

-- AlterTable
ALTER TABLE "FollowUpTask" ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "currency" "CurrencyOption" NOT NULL DEFAULT 'usd',
ADD COLUMN     "language" "LanguageOption" NOT NULL DEFAULT 'english';
