-- Distinguish a public preview file (low-poly glb, watermarked image, etc.)
-- from the private paid original. Defaults to ORIGINAL so seller-uploaded
-- source files keep their existing meaning.
CREATE TYPE "AssetFilePurpose" AS ENUM ('ORIGINAL', 'PREVIEW');

ALTER TABLE "asset_files" ADD COLUMN "purpose" "AssetFilePurpose" NOT NULL DEFAULT 'ORIGINAL';
