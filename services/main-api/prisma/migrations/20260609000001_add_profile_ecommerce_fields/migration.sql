-- AlterTable: replace social links with e-commerce profile fields
ALTER TABLE "user_profiles" ADD COLUMN "country" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "billingAddress" TEXT;
