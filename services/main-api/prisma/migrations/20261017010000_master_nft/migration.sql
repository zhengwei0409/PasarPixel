-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "priceSolCommercial" DECIMAL(20,9),
ADD COLUMN     "priceSolPersonal" DECIMAL(20,9);

-- CreateTable
CREATE TABLE "asset_mint_snapshots" (
    "assetId" INTEGER NOT NULL,
    "listingRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "previewHash" TEXT NOT NULL,
    "originals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_mint_snapshots_pkey" PRIMARY KEY ("assetId")
);

-- CreateTable
CREATE TABLE "nft_public_objects" (
    "hash" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "body" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nft_public_objects_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_mint_snapshots_listingRef_key" ON "asset_mint_snapshots"("listingRef");

CREATE FUNCTION prevent_nft_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'NFT snapshots are immutable';
END;
$$;
CREATE TRIGGER nft_public_objects_immutable BEFORE UPDATE OR DELETE ON "nft_public_objects"
FOR EACH ROW EXECUTE FUNCTION prevent_nft_snapshot_mutation();
CREATE TRIGGER asset_mint_snapshots_immutable BEFORE UPDATE OR DELETE ON "asset_mint_snapshots"
FOR EACH ROW EXECUTE FUNCTION prevent_nft_snapshot_mutation();

