ALTER TABLE "Address" ADD COLUMN "geocodedAt" TIMESTAMP(3);
ALTER TABLE "Vendor" ADD COLUMN "geocodedAt" TIMESTAMP(3);
CREATE INDEX "Address_geocodedAt_idx" ON "Address"("geocodedAt");
CREATE INDEX "Vendor_geocodedAt_idx" ON "Vendor"("geocodedAt");
