-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PREPARING', 'AWAITING_SIGNATURE', 'PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "purchase_intents" (
    "id" TEXT NOT NULL,
    "masterNftId" INTEGER NOT NULL,
    "buyerWalletId" INTEGER NOT NULL,
    "sellerWalletId" INTEGER NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PREPARING',
    "buyerAddress" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "priceLamports" VARCHAR(20) NOT NULL,
    "commissionLamports" VARCHAR(20) NOT NULL,
    "revision" BIGINT NOT NULL,
    "listingAddress" TEXT NOT NULL,
    "receiptAddress" TEXT NOT NULL,
    "assetAddress" TEXT NOT NULL,
    "metadataUri" TEXT NOT NULL DEFAULT '',
    "metadataHash" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "termsVersion" TEXT NOT NULL DEFAULT 'pasarpixel-2026-10-17',
    "termsHash" TEXT NOT NULL DEFAULT '',
    "termsUri" TEXT NOT NULL DEFAULT '',
    "manifestHash" TEXT NOT NULL,
    "preparedTransaction" BYTEA,
    "lastValidBlockHeight" BIGINT,
    "expiresAt" TIMESTAMP(3),
    "txSignature" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "errorMessage" TEXT,
    "mainOrderId" INTEGER,
    "mainOrderItemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_attempts" (
    "id" SERIAL NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "transaction" BYTEA NOT NULL,
    "lastValidBlockHeight" BIGINT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_intents_receiptAddress_key" ON "purchase_intents"("receiptAddress");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_intents_assetAddress_key" ON "purchase_intents"("assetAddress");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_intents_txSignature_key" ON "purchase_intents"("txSignature");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_intents_buyerWalletId_masterNftId_licenseType_key" ON "purchase_intents"("buyerWalletId", "masterNftId", "licenseType");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_attempts_signature_key" ON "purchase_attempts"("signature");

-- AddForeignKey
ALTER TABLE "purchase_intents" ADD CONSTRAINT "purchase_intents_masterNftId_fkey" FOREIGN KEY ("masterNftId") REFERENCES "master_nfts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_intents" ADD CONSTRAINT "purchase_intents_buyerWalletId_fkey" FOREIGN KEY ("buyerWalletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_intents" ADD CONSTRAINT "purchase_intents_sellerWalletId_fkey" FOREIGN KEY ("sellerWalletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_attempts" ADD CONSTRAINT "purchase_attempts_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchase_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_intents" ADD CONSTRAINT purchase_lamports CHECK (
  "priceLamports" ~ '^[1-9][0-9]{0,19}$' AND "priceLamports"::numeric <= 18446744073709551615
  AND "commissionLamports" ~ '^(0|[1-9][0-9]{0,19})$'
  AND "commissionLamports"::numeric = div("priceLamports"::numeric * 500, 10000));

