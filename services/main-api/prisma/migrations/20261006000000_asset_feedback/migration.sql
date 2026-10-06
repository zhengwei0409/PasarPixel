ALTER TABLE "reviews" ADD COLUMN "sellerReply" TEXT,
    ADD COLUMN "sellerReplyUpdatedAt" TIMESTAMP(3);

-- Preserve existing reports. If duplicate user/asset pairs exist, resolve
-- those records before deployment rather than silently deleting history.
CREATE UNIQUE INDEX "reports_userId_assetId_key" ON "reports"("userId", "assetId");
