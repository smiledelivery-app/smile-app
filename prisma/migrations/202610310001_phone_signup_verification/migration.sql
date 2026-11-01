ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE TABLE "PendingPhoneSignup" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingPhoneSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingPhoneSignup_email_key" ON "PendingPhoneSignup"("email");
CREATE UNIQUE INDEX "PendingPhoneSignup_phone_key" ON "PendingPhoneSignup"("phone");
CREATE INDEX "PendingPhoneSignup_expiresAt_idx" ON "PendingPhoneSignup"("expiresAt");
