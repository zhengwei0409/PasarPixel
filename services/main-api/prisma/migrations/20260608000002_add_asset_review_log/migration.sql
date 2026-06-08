-- CreateEnum
CREATE TYPE "AssetReviewAction" AS ENUM ('APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "asset_review_logs" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "adminUserId" INTEGER NOT NULL,
    "action" "AssetReviewAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_review_logs_pkey" PRIMARY KEY ("id")
);
