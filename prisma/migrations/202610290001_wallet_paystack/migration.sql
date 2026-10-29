CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balanceMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "paystackCustomerCode" TEXT,
  "dvaAccountNumber" TEXT,
  "dvaAccountName" TEXT,
  "dvaBankName" TEXT,
  "dvaBankSlug" TEXT,
  "dvaId" TEXT,
  "dvaStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletTransaction" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reference" TEXT NOT NULL,
  "orderId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaystackWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "reference" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaystackWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "Wallet_paystackCustomerCode_key" ON "Wallet"("paystackCustomerCode");
CREATE UNIQUE INDEX "Wallet_dvaAccountNumber_key" ON "Wallet"("dvaAccountNumber");
CREATE UNIQUE INDEX "Wallet_dvaId_key" ON "Wallet"("dvaId");
CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");
CREATE INDEX "WalletTransaction_orderId_idx" ON "WalletTransaction"("orderId");
CREATE UNIQUE INDEX "PaystackWebhookEvent_eventKey_key" ON "PaystackWebhookEvent"("eventKey");
CREATE INDEX "PaystackWebhookEvent_event_receivedAt_idx" ON "PaystackWebhookEvent"("event", "receivedAt");
CREATE INDEX "PaystackWebhookEvent_reference_idx" ON "PaystackWebhookEvent"("reference");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
