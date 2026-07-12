CREATE TYPE "PropertyLocationType" AS ENUM ('residential', 'common_area');

ALTER TABLE "Unit"
  ADD COLUMN "locationType" "PropertyLocationType" NOT NULL DEFAULT 'residential',
  ADD COLUMN "areaType" TEXT;

CREATE INDEX "Unit_propertyId_locationType_isActive_idx" ON "Unit"("propertyId", "locationType", "isActive");

INSERT INTO "Unit" ("id", "propertyId", "label", "locationType", "areaType", "isActive", "createdAt", "updatedAt")
SELECT
  'area_' || md5(property."id" || ':' || area."areaType"),
  property."id",
  area."label",
  'common_area'::"PropertyLocationType",
  area."areaType",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" property
CROSS JOIN (VALUES
  ('Building exterior', 'building_exterior'),
  ('Roof', 'roof'),
  ('Hallway', 'hallway'),
  ('Stairwell', 'stairwell'),
  ('Elevator', 'elevator'),
  ('Parking lot', 'parking'),
  ('Laundry room', 'laundry'),
  ('Leasing office', 'office'),
  ('Pool', 'pool'),
  ('Landscaping', 'landscaping'),
  ('Building-wide plumbing', 'plumbing'),
  ('Building-wide electrical', 'electrical')
) AS area("label", "areaType")
WHERE property."propertyType" = 'multifamily'::"PropertyType"
  AND NOT EXISTS (
    SELECT 1 FROM "Unit" existing
    WHERE existing."propertyId" = property."id"
      AND existing."locationType" = 'common_area'::"PropertyLocationType"
      AND lower(existing."label") = lower(area."label")
  );
