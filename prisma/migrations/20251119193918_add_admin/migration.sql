/*
  Safer migration:
  - Add new columns as nullable
  - Backfill sensible defaults for existing rows
  - Then enforce NOT NULL / UNIQUE constraints
*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "trades"
    ADD COLUMN "direction" TEXT,
    ADD COLUMN "pnl" DOUBLE PRECISION,
    ADD COLUMN "priceClose" DOUBLE PRECISION,
    ADD COLUMN "priceCloseAt" TIMESTAMP(3),
    ADD COLUMN "priceOpen" DOUBLE PRECISION,
    ADD COLUMN "priceOpenAt" TIMESTAMP(3);

-- Backfill existing trades with safe defaults
UPDATE "trades"
SET
    "direction"   = COALESCE("direction", 'UP'),
    "priceOpen"   = COALESCE("priceOpen", 0),
    "priceOpenAt" = COALESCE("priceOpenAt", NOW())
WHERE TRUE;

-- Enforce NOT NULL + defaults for new trades
ALTER TABLE "trades"
    ALTER COLUMN "direction" SET DEFAULT 'UP',
    ALTER COLUMN "direction" SET NOT NULL,
    ALTER COLUMN "priceOpen" SET DEFAULT 0,
    ALTER COLUMN "priceOpen" SET NOT NULL,
    ALTER COLUMN "priceOpenAt" SET DEFAULT NOW(),
    ALTER COLUMN "priceOpenAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "banExpires" TIMESTAMP(3),
    ADD COLUMN "banReason" TEXT,
    ADD COLUMN "banned" BOOLEAN DEFAULT false,
    ADD COLUMN "displayUsername" TEXT,
    ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
    ADD COLUMN "username" TEXT,
    ALTER COLUMN "email" DROP NOT NULL,
    ALTER COLUMN "password" DROP NOT NULL;

-- Backfill usernames/display names for existing users to avoid uniqueness issues
UPDATE "users"
SET "username" = CONCAT('user_', SUBSTRING("id" FROM 1 FOR 8))
WHERE "username" IS NULL;

UPDATE "users"
SET "displayUsername" = "username"
WHERE "displayUsername" IS NULL AND "username" IS NOT NULL;

-- AlterTable
ALTER TABLE "withdraw_requests"
    ADD COLUMN "adminNotes" TEXT,
    ADD COLUMN "toAddress" TEXT;

-- Backfill withdraw addresses
UPDATE "withdraw_requests"
SET "toAddress" = COALESCE("toAddress", 'unknown')
WHERE TRUE;

ALTER TABLE "withdraw_requests"
    ALTER COLUMN "toAddress" SET DEFAULT 'unknown',
    ALTER COLUMN "toAddress" SET NOT NULL;

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_displayUsername_key" ON "users"("displayUsername");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
