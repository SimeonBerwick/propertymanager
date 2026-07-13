ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'canadian_french';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'portuguese';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'polish';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'greek';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'simplified_chinese';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'arabic';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'punjabi';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'vietnamese';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'filipino';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'urdu';
ALTER TYPE "LanguageOption" ADD VALUE IF NOT EXISTS 'romanian';

ALTER TABLE "User" ADD COLUMN "preferredLanguage" "LanguageOption" NOT NULL DEFAULT 'english';
ALTER TABLE "TenantIdentity" ADD COLUMN "preferredLanguage" "LanguageOption" NOT NULL DEFAULT 'english';
ALTER TABLE "Vendor" ADD COLUMN "preferredLanguage" "LanguageOption" NOT NULL DEFAULT 'english';
ALTER TABLE "StaffMember" ADD COLUMN "preferredLanguage" "LanguageOption" NOT NULL DEFAULT 'english';
ALTER TABLE "User" ADD COLUMN "languagePreferenceExplicit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantIdentity" ADD COLUMN "languagePreferenceExplicit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN "languagePreferenceExplicit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StaffMember" ADD COLUMN "languagePreferenceExplicit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RequestComment" ADD COLUMN "sourceLanguage" "LanguageOption";

CREATE TABLE "RequestCommentTranslation" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "language" "LanguageOption" NOT NULL,
  "translatedBody" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestCommentTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TranslationCache" (
  "id" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "sourceLanguage" TEXT NOT NULL,
  "targetLanguage" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "translatedText" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequestCommentTranslation_commentId_language_key" ON "RequestCommentTranslation"("commentId", "language");
CREATE INDEX "RequestCommentTranslation_language_updatedAt_idx" ON "RequestCommentTranslation"("language", "updatedAt");
CREATE UNIQUE INDEX "TranslationCache_sourceHash_sourceLanguage_targetLanguage_context_key" ON "TranslationCache"("sourceHash", "sourceLanguage", "targetLanguage", "context");
CREATE INDEX "TranslationCache_targetLanguage_context_updatedAt_idx" ON "TranslationCache"("targetLanguage", "context", "updatedAt");

ALTER TABLE "RequestCommentTranslation"
  ADD CONSTRAINT "RequestCommentTranslation_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "RequestComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
