-- DropIndex
DROP INDEX "VisibilityPrompt_brandId_active_idx";

-- DropIndex
DROP INDEX "VisibilityPrompt_brandId_text_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "tracked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VisibilityPrompt" ADD COLUMN     "lastRunAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VisibilityRun" ADD COLUMN     "creditsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locales" TEXT[],
ADD COLUMN     "productsCovered" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recommendations" JSONB;

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditEntry_brandId_createdAt_idx" ON "CreditEntry"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_brandId_tracked_idx" ON "Product"("brandId", "tracked");

-- CreateIndex
CREATE INDEX "VisibilityPrompt_brandId_active_lastRunAt_idx" ON "VisibilityPrompt"("brandId", "active", "lastRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityPrompt_brandId_locale_text_key" ON "VisibilityPrompt"("brandId", "locale", "text");

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

