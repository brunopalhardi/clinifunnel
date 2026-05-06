import { Worker, Queue } from "bullmq";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "sync-google-ads" });

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
    log.info("starting sync");

    const clinics = await prisma.clinic.findMany({
      where: { googleAdsRefreshToken: { not: null } },
      select: {
        id: true,
        googleAdsRefreshToken: true,
        googleAdsCustomerId: true,
      },
    });

    if (clinics.length === 0) {
      log.info("no clinics with Google Ads connected");
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

        log.info({ clinicId: clinic.id, upserted }, "rows upserted");
      } catch (err) {
        if (err instanceof GoogleAdsApiError && err.isAuthError) {
          log.error("Auth error for clinic ${clinic.id}, clearing token");
          await prisma.clinic.update({
            where: { id: clinic.id },
            data: { googleAdsRefreshToken: null },
          });
        } else {
          log.error({ clinicId: clinic.id, err }, "sync error for clinic");
        }
      }
    }

    log.info("sync complete");
  },
  { connection: redis }
);
