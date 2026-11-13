ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3),
    ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "refresh_tokens" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "account_moderation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "suspended" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "account_moderation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_moderation_publishedAt_id_idx" ON "account_moderation"("publishedAt", "id");
