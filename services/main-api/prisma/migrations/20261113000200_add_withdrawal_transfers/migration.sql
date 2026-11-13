ALTER TABLE "withdrawal_requests" ADD COLUMN "stripeTransferId" TEXT;

CREATE UNIQUE INDEX "withdrawal_requests_stripeTransferId_key" ON "withdrawal_requests"("stripeTransferId");

CREATE TABLE "withdrawal_transfer_attempts" (
    "id" TEXT NOT NULL,
    "withdrawalId" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_transfer_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "withdrawal_transfer_attempts_withdrawalId_key" ON "withdrawal_transfer_attempts"("withdrawalId");

ALTER TABLE "withdrawal_transfer_attempts" ADD CONSTRAINT "withdrawal_transfer_attempts_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawal_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
