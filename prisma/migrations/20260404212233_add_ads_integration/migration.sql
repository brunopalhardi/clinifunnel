-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "clinicorpAutoCreatePatient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clinicorpWebhookEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "googleAdsCustomerId" TEXT,
ADD COLUMN     "googleAdsRefreshToken" TEXT,
ADD COLUMN     "metaAccessToken" TEXT,
ADD COLUMN     "metaAdAccountId" TEXT,
ADD COLUMN     "metaTokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaignData" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaignData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clinicId_idx" ON "User"("clinicId");

-- CreateIndex
CREATE INDEX "AdCampaignData_clinicId_date_idx" ON "AdCampaignData"("clinicId", "date");

-- CreateIndex
CREATE INDEX "AdCampaignData_clinicId_campaignName_idx" ON "AdCampaignData"("clinicId", "campaignName");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaignData_clinicId_platform_campaignId_date_key" ON "AdCampaignData"("clinicId", "platform", "campaignId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaignData" ADD CONSTRAINT "AdCampaignData_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
