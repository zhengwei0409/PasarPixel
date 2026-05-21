-- AlterTable
ALTER TABLE "seller_applications" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "idVerificationUrl" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
