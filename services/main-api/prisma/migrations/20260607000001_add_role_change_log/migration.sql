-- CreateEnum
CREATE TYPE "RoleChangeAction" AS ENUM ('GRANT', 'REVOKE');

-- CreateTable
CREATE TABLE "role_change_logs" (
    "id" SERIAL NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "adminUserId" INTEGER NOT NULL,
    "action" "RoleChangeAction" NOT NULL,
    "role" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_change_logs_pkey" PRIMARY KEY ("id")
);
