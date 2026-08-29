-- CreateEnum
CREATE TYPE "ScanMode" AS ENUM ('SHALLOW', 'DEEP');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('MONITOR', 'AGENCY');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT,
    "industry" TEXT,
    "platform" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "mode" "ScanMode" NOT NULL DEFAULT 'SHALLOW',
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "score" INTEGER,
    "grade" TEXT,
    "dimensions" JSONB,
    "urlsFetched" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "error" TEXT,
    "rubricVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalResult" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidence" JSONB,

    CONSTRAINT "SignalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL DEFAULT 'MONITOR',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditOrder" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'chf',
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deepScanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "AuditOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromScore" INTEGER,
    "toScore" INTEGER,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_domain_key" ON "Brand"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_country_idx" ON "Brand"("country");

-- CreateIndex
CREATE INDEX "Brand_industry_idx" ON "Brand"("industry");

-- CreateIndex
CREATE INDEX "Scan_brandId_createdAt_idx" ON "Scan"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_score_idx" ON "Scan"("score");

-- CreateIndex
CREATE INDEX "SignalResult_scanId_idx" ON "SignalResult"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalResult_scanId_signalId_key" ON "SignalResult"("scanId", "signalId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_brandId_key" ON "Subscription"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditOrder_stripeSessionId_key" ON "AuditOrder"("stripeSessionId");

-- CreateIndex
CREATE INDEX "AuditOrder_brandId_idx" ON "AuditOrder"("brandId");

-- CreateIndex
CREATE INDEX "Alert_brandId_createdAt_idx" ON "Alert"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalResult" ADD CONSTRAINT "SignalResult_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditOrder" ADD CONSTRAINT "AuditOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
