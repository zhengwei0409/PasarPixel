ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_SUSPENDED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_UNSUSPENDED';

ALTER TABLE "Notification" ADD COLUMN "accountModerationId" INTEGER;
CREATE UNIQUE INDEX "Notification_accountModerationId_key" ON "Notification"("accountModerationId");
