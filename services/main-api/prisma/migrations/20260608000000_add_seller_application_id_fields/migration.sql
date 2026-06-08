-- Add real identity fields to the seller application: full legal name, date of
-- birth, and address. Replace the free-text idVerificationUrl link with an
-- idDocumentKey that points to a private object in S3 (served via presigned URL).
ALTER TABLE "seller_applications" ADD COLUMN "fullName" TEXT;
ALTER TABLE "seller_applications" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "seller_applications" ADD COLUMN "address" TEXT;
ALTER TABLE "seller_applications" ADD COLUMN "idDocumentKey" TEXT;

-- Carry over any existing links so old applications keep a reference, then drop
-- the old column.
UPDATE "seller_applications" SET "idDocumentKey" = "idVerificationUrl" WHERE "idVerificationUrl" IS NOT NULL;
ALTER TABLE "seller_applications" DROP COLUMN "idVerificationUrl";
