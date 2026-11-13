CREATE TABLE "seller_stripe_accounts" (
    "sellerId" INTEGER NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    CONSTRAINT "seller_stripe_accounts_pkey" PRIMARY KEY ("sellerId"),
    CONSTRAINT "seller_stripe_accounts_sellerId_fkey" FOREIGN KEY ("sellerId")
        REFERENCES "user_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "seller_stripe_accounts_stripeAccountId_key"
    ON "seller_stripe_accounts"("stripeAccountId");
