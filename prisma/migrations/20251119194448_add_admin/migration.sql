-- AlterTable
ALTER TABLE "trades" ALTER COLUMN "direction" DROP DEFAULT,
ALTER COLUMN "priceOpen" DROP DEFAULT,
ALTER COLUMN "priceOpenAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "withdraw_requests" ALTER COLUMN "toAddress" DROP DEFAULT;
