CREATE TYPE "DeliveryStatus" AS ENUM ('OFFERING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'UNASSIGNED', 'EXCEPTION');
CREATE TYPE "RiderOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

ALTER TABLE "RiderProfile" DROP COLUMN "approved";
ALTER TABLE "RiderProfile" ADD COLUMN "status" "VendorStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "RiderProfile" ADD COLUMN "serviceArea" TEXT NOT NULL DEFAULT '';

CREATE TABLE "RiderLocation" (
  "id" TEXT NOT NULL, "riderId" TEXT NOT NULL, "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiderLocation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Delivery" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "assignedRiderId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'OFFERING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedAt" TIMESTAMP(3), "pickedUpAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3), "proofAttempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RiderOffer" (
  "id" TEXT NOT NULL, "deliveryId" TEXT NOT NULL, "riderId" TEXT NOT NULL,
  "status" "RiderOfferStatus" NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RiderOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiderLocation_riderId_key" ON "RiderLocation"("riderId");
CREATE INDEX "RiderLocation_updatedAt_idx" ON "RiderLocation"("updatedAt");
CREATE UNIQUE INDEX "Delivery_orderId_key" ON "Delivery"("orderId");
CREATE INDEX "Delivery_status_createdAt_idx" ON "Delivery"("status", "createdAt");
CREATE INDEX "Delivery_assignedRiderId_status_idx" ON "Delivery"("assignedRiderId", "status");
CREATE UNIQUE INDEX "RiderOffer_deliveryId_riderId_key" ON "RiderOffer"("deliveryId", "riderId");
CREATE INDEX "RiderOffer_riderId_status_expiresAt_idx" ON "RiderOffer"("riderId", "status", "expiresAt");
CREATE INDEX "RiderOffer_deliveryId_status_expiresAt_idx" ON "RiderOffer"("deliveryId", "status", "expiresAt");
ALTER TABLE "RiderLocation" ADD CONSTRAINT "RiderLocation_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_assignedRiderId_fkey" FOREIGN KEY ("assignedRiderId") REFERENCES "RiderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiderOffer" ADD CONSTRAINT "RiderOffer_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderOffer" ADD CONSTRAINT "RiderOffer_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
