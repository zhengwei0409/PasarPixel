-- CreateTable
CREATE TABLE "stores" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "storeName" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_sellerId_key" ON "stores"("sellerId");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: give every existing approved seller a shop, seeded from the
-- store name on their most recently reviewed approved application.
INSERT INTO "stores" ("sellerId", "storeName", "updatedAt")
SELECT DISTINCT ON (sa."userId") sa."userId", sa."storeName", CURRENT_TIMESTAMP
FROM "seller_applications" sa
WHERE sa."status" = 'APPROVED'
ORDER BY sa."userId", sa."reviewedAt" DESC NULLS LAST;
