ALTER TABLE "Wallet"
  ADD COLUMN "payoutAccountLast4" TEXT,
  ADD COLUMN "payoutAccountName" TEXT,
  ADD COLUMN "payoutBankName" TEXT,
  ADD COLUMN "payoutBankCode" TEXT,
  ADD COLUMN "payoutRecipientCode" TEXT,
  ADD COLUMN "payoutStatus" TEXT NOT NULL DEFAULT 'NOT_SET';

ALTER TABLE "WalletTransaction"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUCCEEDED';
