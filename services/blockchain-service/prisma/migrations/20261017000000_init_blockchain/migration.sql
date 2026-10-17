-- Prisma deploy creates the schema selected by DATABASE_URL (blockchain).

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('PERSONAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_challenges" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "wallet_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_nfts" (
    "id" SERIAL NOT NULL,
    "ownerWalletId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "metadataUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_nfts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_nfts" (
    "id" SERIAL NOT NULL,
    "masterNftId" INTEGER NOT NULL,
    "holderWalletId" INTEGER NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "metadataUri" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_nfts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_transactions" (
    "id" SERIAL NOT NULL,
    "licenseNftId" INTEGER NOT NULL,
    "sellerWalletId" INTEGER NOT NULL,
    "buyerWalletId" INTEGER NOT NULL,
    "txSignature" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_challenges_userId_key" ON "wallet_challenges"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "master_nfts_mintAddress_key" ON "master_nfts"("mintAddress");

-- CreateIndex
CREATE UNIQUE INDEX "license_nfts_orderItemId_key" ON "license_nfts"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "license_nfts_mintAddress_key" ON "license_nfts"("mintAddress");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_licenseNftId_key" ON "blockchain_transactions"("licenseNftId");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_txSignature_key" ON "blockchain_transactions"("txSignature");

-- AddForeignKey
ALTER TABLE "master_nfts" ADD CONSTRAINT "master_nfts_ownerWalletId_fkey" FOREIGN KEY ("ownerWalletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_nfts" ADD CONSTRAINT "license_nfts_masterNftId_fkey" FOREIGN KEY ("masterNftId") REFERENCES "master_nfts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_nfts" ADD CONSTRAINT "license_nfts_holderWalletId_fkey" FOREIGN KEY ("holderWalletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_licenseNftId_fkey" FOREIGN KEY ("licenseNftId") REFERENCES "license_nfts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_sellerWalletId_fkey" FOREIGN KEY ("sellerWalletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_buyerWalletId_fkey" FOREIGN KEY ("buyerWalletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

