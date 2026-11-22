ALTER TABLE "Order" ADD COLUMN "displayNumber" INTEGER;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS "number"
  FROM "Order"
)
UPDATE "Order"
SET "displayNumber" = ranked."number"
FROM ranked
WHERE "Order"."id" = ranked."id";

ALTER TABLE "Order" ALTER COLUMN "displayNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Order_displayNumber_key" ON "Order"("displayNumber");

CREATE SEQUENCE "Order_displayNumber_seq";
SELECT setval('"Order_displayNumber_seq"', COALESCE((SELECT MAX("displayNumber") FROM "Order"), 0), true);
ALTER SEQUENCE "Order_displayNumber_seq" OWNED BY "Order"."displayNumber";
ALTER TABLE "Order" ALTER COLUMN "displayNumber" SET DEFAULT nextval('"Order_displayNumber_seq"');
