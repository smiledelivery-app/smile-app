UPDATE "RiderProfile"
SET "available" = true
WHERE "status" = 'APPROVED';

ALTER TABLE "RiderProfile"
ALTER COLUMN "available" SET DEFAULT true;
