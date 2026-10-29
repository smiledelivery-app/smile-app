CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'VENDOR', 'RIDER', 'ADMIN');
CREATE TYPE "VendorStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'ACCEPTED_BY_VENDOR', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'PAYMENT_FAILED', 'REJECTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'DELIVERY_EXCEPTION');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "passwordHash" TEXT NOT NULL, "name" TEXT NOT NULL,
  "roles" "Role"[] NOT NULL DEFAULT ARRAY['CUSTOMER']::"Role"[], "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Address" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "label" TEXT NOT NULL, "line1" TEXT NOT NULL, "city" TEXT NOT NULL,
  "latitude" DECIMAL(9,6), "longitude" DECIMAL(9,6), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Session" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Vendor" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "cuisine" TEXT NOT NULL, "address" TEXT NOT NULL,
  "latitude" DECIMAL(9,6), "longitude" DECIMAL(9,6), "status" "VendorStatus" NOT NULL DEFAULT 'DRAFT',
  "isOpen" BOOLEAN NOT NULL DEFAULT false, "isDemo" BOOLEAN NOT NULL DEFAULT false, "termsAcceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Product" (
  "id" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL, "priceMinor" INTEGER NOT NULL, "imageUrl" TEXT, "available" BOOLEAN NOT NULL DEFAULT true,
  "stock" INTEGER, "isDemo" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Order" (
  "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "subtotalMinor" INTEGER NOT NULL, "deliveryFeeMinor" INTEGER NOT NULL, "totalMinor" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "addressId" TEXT, "deliveryNotes" TEXT, "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "nameSnapshot" TEXT NOT NULL,
  "unitPriceMinor" INTEGER NOT NULL, "quantity" INTEGER NOT NULL, CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderStatusEvent" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "status" "OrderStatus" NOT NULL, "actorId" TEXT NOT NULL,
  "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "amountMinor" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "provider" TEXT NOT NULL, "providerReference" TEXT, "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RiderProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "approved" BOOLEAN NOT NULL DEFAULT false,
  "available" BOOLEAN NOT NULL DEFAULT false, "vehicleType" TEXT, CONSTRAINT "RiderProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "Address_userId_idx" ON "Address"("userId");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE UNIQUE INDEX "Vendor_ownerId_key" ON "Vendor"("ownerId");
CREATE UNIQUE INDEX "Vendor_slug_key" ON "Vendor"("slug");
CREATE INDEX "Vendor_status_isOpen_idx" ON "Vendor"("status", "isOpen");
CREATE INDEX "Product_vendorId_available_idx" ON "Product"("vendorId", "available");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "Order_vendorId_status_idx" ON "Order"("vendorId", "status");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderStatusEvent_orderId_createdAt_idx" ON "OrderStatusEvent"("orderId", "createdAt");
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");
CREATE UNIQUE INDEX "RiderProfile_userId_key" ON "RiderProfile"("userId");

ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderProfile" ADD CONSTRAINT "RiderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
