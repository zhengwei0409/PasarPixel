-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'SOL');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "blockchainSignature" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'STRIPE',
ADD COLUMN     "purchaseRef" TEXT,
ADD COLUMN     "totalLamports" VARCHAR(20);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "accessRevokedAt" TIMESTAMP(3),
ADD COLUMN     "blockchainPurchaseRef" TEXT,
ADD COLUMN     "buyerWalletAddress" TEXT,
ADD COLUMN     "commissionLamports" VARCHAR(20),
ADD COLUMN     "licenseAssetAddress" TEXT,
ADD COLUMN     "manifestHash" TEXT,
ADD COLUMN     "masterAssetAddress" TEXT,
ADD COLUMN     "metadataUri" TEXT,
ADD COLUMN     "originalSnapshot" JSONB,
ADD COLUMN     "priceLamports" VARCHAR(20),
ADD COLUMN     "receiptAddress" TEXT,
ADD COLUMN     "termsHash" TEXT,
ADD COLUMN     "termsUri" TEXT,
ADD COLUMN     "termsVersion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_purchaseRef_key" ON "orders"("purchaseRef");

-- CreateIndex
CREATE UNIQUE INDEX "orders_blockchainSignature_key" ON "orders"("blockchainSignature");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_blockchainPurchaseRef_key" ON "order_items"("blockchainPurchaseRef");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_licenseAssetAddress_key" ON "order_items"("licenseAssetAddress");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_receiptAddress_key" ON "order_items"("receiptAddress");

-- Preserve full u64 prices as canonical decimal strings (PostgreSQL bigint is signed).
ALTER TABLE "orders" ADD CONSTRAINT sol_order_amount CHECK (
  "paymentMethod" <> 'SOL' OR ("totalAmount" = 0 AND "purchaseRef" IS NOT NULL AND "blockchainSignature" IS NOT NULL
    AND "totalLamports" IS NOT NULL AND "totalLamports" ~ '^[1-9][0-9]{0,19}$' AND "totalLamports"::numeric <= 18446744073709551615));
ALTER TABLE "order_items" ADD CONSTRAINT sol_item_amount CHECK (
  "blockchainPurchaseRef" IS NULL OR ("price" = 0 AND "priceLamports" IS NOT NULL AND "commissionLamports" IS NOT NULL
    AND "priceLamports" ~ '^[1-9][0-9]{0,19}$' AND "commissionLamports" ~ '^(0|[1-9][0-9]{0,19})$'
    AND "priceLamports"::numeric <= 18446744073709551615 AND "commissionLamports"::numeric = div("priceLamports"::numeric * 500, 10000)
    AND "licenseAssetAddress" IS NOT NULL AND "masterAssetAddress" IS NOT NULL AND "receiptAddress" IS NOT NULL
    AND "buyerWalletAddress" IS NOT NULL AND "manifestHash" IS NOT NULL AND "termsHash" IS NOT NULL AND "originalSnapshot" IS NOT NULL));

