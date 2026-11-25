CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseDeliveryFeeMinor" INTEGER NOT NULL DEFAULT 50000,
    "deliveryFeePerKmMinor" INTEGER NOT NULL DEFAULT 15000,
    "serviceFeeMinor" INTEGER NOT NULL DEFAULT 50000,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentSettings"
ADD CONSTRAINT "PaymentSettings_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
