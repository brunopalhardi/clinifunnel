import { Worker, Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import { GoogleAdsClient, GoogleAdsApiError } from "@/lib/ads/google-ads-client";
import { redis } from "@/lib/redis";

const QUEUE_NAME = "sync-google-ads";

export const syncGoogleAdsQueue = new Queue(QUEUE_NAME, { connection: redis });

// Agendar sync a cada 6 horas
syncGoogleAdsQueue.add("sync", {}, {
  repeat: { every: 6 * 60 * 60 * 1000 },
  removeOnComplete: 50,
  removeOnFail: 50,
});

export const syncGoogleAdsWorker = new Worker(
  QUEUE_NAME,
  async () => {
    console.log("[sync-google-ads] Starting sync...");

    const clinics = await prisma.clinic.findMany({
      where: { googleAdsRefreshToken: { not: null } },
      select: {
        id: true,
        googleAdsRefreshToken: true,
        googleAdsCustomerId: true,
      },
    });

    if (clinics.length === 0) {
      console.log("[sync-google-ads] No clinics with Google Ads connected");
      return;
    }

    for (const clinic of clinics) {
      try {
        const client = new GoogleAdsClient(
          clinic.googleAdsRefreshToken!,
          clinic.googleAdsCustomerId!
        );

        // Puxar últimos 7 dias
        const now = new Date();
        const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dateFrom = from.toISOString().slice(0, 10);
        const dateTo = now.toISOString().slice(0, 10);

        const metrics = await client.getCampaignMetrics(dateFrom, dateTo);

        let upserted = 0;
        for (const row of metrics) {
          await prisma.adCampaignData.upsert({
            where: {
              clinicId_platform_campaignId_date: {
                clinicId: clinic.id,
                platform: "google",
                campaignId: row.campaignId,
                date: new Date(row.date),
              },
            },
            update: {
              campaignName: row.campaignName,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            },
            create: {
              clinicId: clinic.id,
              platform: "google",
              campaignId: row.campaignId,
              campaignName: row.campaignName,
              date: new Date(row.date),
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            },
          });
          upserted++;
        }

        console.log(`[sync-google-ads] Clinic ${clinic.id}: ${upserted} rows upserted`);
      } catch (err) {
        if (err instanceof GoogleAdsApiError && err.isAuthError) {
          console.error(`[sync-google-ads] Auth error for clinic ${clinic.id}, clearing token`);
          await prisma.clinic.update({
            where: { id: clinic.id },
            data: { googleAdsRefreshToken: null },
          });
        } else {
          console.error(`[sync-google-ads] Error for clinic ${clinic.id}:`, err);
        }
      }
    }

    console.log("[sync-google-ads] Sync complete");
  },
  { connection: redis }
);
