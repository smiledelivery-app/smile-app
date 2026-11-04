ALTER TABLE "RiderProfile"
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "ninCiphertext" TEXT,
ADD COLUMN "ninDocumentPublicId" TEXT,
ADD COLUMN "ninDocumentVersion" INTEGER,
ADD COLUMN "plateNumber" TEXT,
ADD COLUMN "residentialAddress" TEXT,
ADD COLUMN "guarantorName" TEXT,
ADD COLUMN "guarantorNinCiphertext" TEXT,
ADD COLUMN "guarantorAddress" TEXT;
