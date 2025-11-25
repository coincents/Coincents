-- CreateTable
CREATE TABLE "deposit_addresses" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_addresses_token_key" ON "deposit_addresses"("token");
