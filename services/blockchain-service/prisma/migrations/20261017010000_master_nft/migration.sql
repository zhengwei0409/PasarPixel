-- CreateEnum
CREATE TYPE "MasterMintStatus" AS ENUM ('PREPARING', 'AWAITING_SIGNATURE', 'PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "master_nfts" ADD COLUMN     "authorizationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "authorizationId" TEXT,
ADD COLUMN     "authorizationMessage" TEXT,
ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMP(3),
ADD COLUMN     "manifestHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mintReference" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ownerAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" "MasterMintStatus" NOT NULL DEFAULT 'PREPARING',
ADD COLUMN     "txSignature" TEXT,
ALTER COLUMN "metadataUri" SET DEFAULT '';

ALTER TABLE "master_nfts" ALTER COLUMN "mintReference" DROP DEFAULT;

-- CreateTable
CREATE TABLE "master_mint_attempts" (
    "id" SERIAL NOT NULL,
    "masterNftId" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "transaction" BYTEA NOT NULL,
    "lastValidBlockHeight" BIGINT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_mint_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_metadata" (
    "hash" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nft_metadata_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_mint_attempts_signature_key" ON "master_mint_attempts"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "master_nfts_assetId_key" ON "master_nfts"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "master_nfts_mintReference_key" ON "master_nfts"("mintReference");

-- CreateIndex
CREATE UNIQUE INDEX "master_nfts_authorizationId_key" ON "master_nfts"("authorizationId");

-- AddForeignKey
ALTER TABLE "master_mint_attempts" ADD CONSTRAINT "master_mint_attempts_masterNftId_fkey" FOREIGN KEY ("masterNftId") REFERENCES "master_nfts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_nft_metadata_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'NFT metadata is immutable';
END;
$$;
CREATE TRIGGER nft_metadata_immutable BEFORE UPDATE OR DELETE ON "nft_metadata"
FOR EACH ROW EXECUTE FUNCTION prevent_nft_metadata_mutation();

