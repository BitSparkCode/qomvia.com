-- AlterTable
ALTER TABLE "Competitor" ADD COLUMN     "tracked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CompetitorSlot" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSlot_stripeSubscriptionId_key" ON "CompetitorSlot"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSlot_stripeSessionId_key" ON "CompetitorSlot"("stripeSessionId");

-- CreateIndex
CREATE INDEX "CompetitorSlot_brandId_status_idx" ON "CompetitorSlot"("brandId", "status");

-- AddForeignKey
ALTER TABLE "CompetitorSlot" ADD CONSTRAINT "CompetitorSlot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

