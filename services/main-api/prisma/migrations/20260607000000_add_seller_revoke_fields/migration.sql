-- Add a REVOKED status so revoked sellers are distinguishable from rejected applicants.
ALTER TYPE "SellerApplicationStatus" ADD VALUE 'REVOKED';

-- Mark assets hidden specifically by a seller revoke, so a later reinstate
-- restores exactly those and never re-publishes assets hidden for other reasons.
ALTER TABLE "assets" ADD COLUMN "hiddenByRevoke" BOOLEAN NOT NULL DEFAULT false;
