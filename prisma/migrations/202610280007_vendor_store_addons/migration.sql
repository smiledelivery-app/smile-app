ALTER TABLE "Vendor" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "cacNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "cacDocumentUrl" TEXT;

CREATE TABLE "ProductAddon" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priceMinor" INTEGER NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAddon_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderItemAddon" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "unitPriceMinor" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "OrderItemAddon_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductAddon_productId_available_idx" ON "ProductAddon"("productId", "available");
CREATE INDEX "OrderItemAddon_orderItemId_idx" ON "OrderItemAddon"("orderItemId");
ALTER TABLE "ProductAddon" ADD CONSTRAINT "ProductAddon_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemAddon" ADD CONSTRAINT "OrderItemAddon_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
