CREATE TYPE "Currency" AS ENUM ('USD', 'MYR');

ALTER TABLE "assets" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'USD';
ALTER TABLE "assets" ADD COLUMN "priceSol" DECIMAL(65,30);
