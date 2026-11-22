CREATE TABLE "VendorOperatingHour" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "openingTime" TEXT,
  "closingTime" TEXT,
  CONSTRAINT "VendorOperatingHour_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorOperatingHour_dayOfWeek_check" CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
  CONSTRAINT "VendorOperatingHour_times_check" CHECK (
    ("isClosed" = true AND "openingTime" IS NULL AND "closingTime" IS NULL) OR
    ("isClosed" = false AND "openingTime" IS NOT NULL AND "closingTime" IS NOT NULL)
  ),
  CONSTRAINT "VendorOperatingHour_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VendorOperatingHour_vendorId_dayOfWeek_key" ON "VendorOperatingHour"("vendorId", "dayOfWeek");
CREATE INDEX "VendorOperatingHour_vendorId_idx" ON "VendorOperatingHour"("vendorId");

INSERT INTO "VendorOperatingHour" ("id", "vendorId", "dayOfWeek", "isClosed", "openingTime", "closingTime")
SELECT 'vendor-hours-' || "id" || '-' || day, "id", day, false, "openingTime", "closingTime"
FROM "Vendor", generate_series(0, 6) AS day;
