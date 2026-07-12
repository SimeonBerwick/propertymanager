CREATE TYPE "PropertyType" AS ENUM ('single_family', 'multifamily');

ALTER TABLE "Property" ADD COLUMN "propertyType" "PropertyType" NOT NULL DEFAULT 'single_family';
