ALTER TYPE "CurrencyOption" ADD VALUE IF NOT EXISTS 'cad';
ALTER TYPE "CurrencyOption" ADD VALUE IF NOT EXISTS 'aud';

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "defaultCurrency" "CurrencyOption" NOT NULL DEFAULT 'usd';
