BEGIN;

LOCK TABLE "withdrawal_requests", "withdrawal_transfer_attempts" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "withdrawal_requests")
        OR EXISTS (SELECT 1 FROM "withdrawal_transfer_attempts") THEN
        RAISE EXCEPTION 'Archive existing withdrawal records before removing the old withdrawal tables';
    END IF;
END
$$;

DROP TABLE "withdrawal_transfer_attempts";
DROP TABLE "withdrawal_requests";
DROP TYPE "WithdrawalStatus";

COMMIT;
