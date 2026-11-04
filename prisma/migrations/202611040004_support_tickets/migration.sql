CREATE TYPE "SupportTicketCategory" AS ENUM (
  'CUSTOMER_COMPLAINT',
  'VENDOR_COMPLAINT',
  'RIDER_COMPLAINT',
  'ORDER_DISPUTE',
  'REFUND_REQUEST',
  'PAYMENT_COMPLAINT',
  'DELIVERY_COMPLAINT',
  'OTHER'
);

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "customerId" TEXT,
  "orderId" TEXT,
  "createdById" TEXT NOT NULL,
  "assignedAdminId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SupportTicket_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");
CREATE INDEX "SupportTicket_category_createdAt_idx" ON "SupportTicket"("category", "createdAt");
CREATE INDEX "SupportTicket_customerId_createdAt_idx" ON "SupportTicket"("customerId", "createdAt");
CREATE INDEX "SupportTicket_orderId_idx" ON "SupportTicket"("orderId");
CREATE INDEX "SupportTicket_assignedAdminId_status_idx" ON "SupportTicket"("assignedAdminId", "status");
