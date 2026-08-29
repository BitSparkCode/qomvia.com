-- CreateTable
CREATE TABLE "StoreLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'watched',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'watched',
    "state" TEXT NOT NULL DEFAULT 'queued',
    "source" TEXT,
    "sourceUrl" TEXT,
    "maxProducts" INTEGER NOT NULL,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsImported" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreLink_brandId_idx" ON "StoreLink"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreLink_userId_brandId_key" ON "StoreLink"("userId", "brandId");

-- CreateIndex
CREATE INDEX "DomainClaim_userId_brandId_createdAt_idx" ON "DomainClaim"("userId", "brandId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_state_createdAt_idx" ON "ImportJob"("state", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_brandId_createdAt_idx" ON "ImportJob"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreLink" ADD CONSTRAINT "StoreLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreLink" ADD CONSTRAINT "StoreLink_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainClaim" ADD CONSTRAINT "DomainClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainClaim" ADD CONSTRAINT "DomainClaim_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

