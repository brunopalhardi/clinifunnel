import { Worker, Queue } from "bullmq";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "sync-meta-ads" });

import { prisma } from "@/lib/prisma";
import { MetaAdsClient, MetaApiError } from "@/lib/ads/meta-client";
import { redis } from "@/lib/redis";

const QUEUE_NAME = "sync-meta-ads";

export const syncMetaAdsQueue = new Queue(QUEUE_NAME, { connection: redis });

// Agendar sync a cada 6 horas
syncMetaAdsQueue.add("sync", {}, {
  repeat: { every: 6 * 60 * 60 * 1000 },
  removeOnComplete: 50,
  removeOnFail: 50,
});

export const syncMetaAdsWorker = new Worker(
  QUEUE_NAME,
  async () => {
    log.info("starting sync");

    const clinics = await prisma.clinic.findMany({
      where: { metaAccessToken: { not: null } },
      select: {
        id: true,
        metaAccessToken: true,
        metaAdAccountId: true,
        metaTokenExpiresAt: true,
      },
    });

    if (clinics.length === 0) {
      log.info("no clinics with Meta connected");
      return;
    }

    for (const clinic of clinics) {
      try {
        // Refresh proativo: renovar se expira em menos de 10 dias
        if (clinic.metaTokenExpiresAt) {
          const daysUntilExpiry =
            (clinic.metaTokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

          if (daysUntilExpiry < 0) {
            log.info({ clinicId: clinic.id }, "token expired, clearing");
            await prisma.clinic.update({
              where: { id: clinic.id },
              data: { metaAccessToken: null, metaTokenExpiresAt: null },
            });
            continue;
          }

          if (daysUntilExpiry < 10) {
            log.info({ clinicId: clinic.id, daysUntilExpiry: Math.round(daysUntilExpiry) }, "refreshing token");
            const { accessToken, expiresIn } =
              await MetaAdsClient.refreshLongLivedToken(clinic.metaAccessToken!);
            await prisma.clinic.update({
              where: { id: clinic.id },
              data: {
                metaAccessToken: accessToken,
                metaTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
              },
            });
            clinic.metaAccessToken = accessToken;
          }
        }

        const client = new MetaAdsClient(
          clinic.metaAccessToken!,
          clinic.metaAdAccountId!
        );

        // Puxar últimos 7 dias
        const now = new Date();
        const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dateFrom = from.toISOString().slice(0, 10);
        const dateTo = now.toISOString().slice(0, 10);

        const insights = await client.getCampaignInsights(dateFrom, dateTo);

        // Upsert no banco
        let upserted = 0;
        for (const insight of insights) {
          await prisma.adCampaignData.upsert({
            where: {
              clinicId_platform_campaignId_date: {
                clinicId: clinic.id,
                platform: "meta",
                campaignId: insight.campaignId,
                date: new Date(insight.date),
              },
            },
            update: {
              campaignName: insight.campaignName,
              impressions: insight.impressions,
              clicks: insight.clicks,
              spend: insight.spend,
            },
            create: {
              clinicId: clinic.id,
              platform: "meta",
              campaignId: insight.campaignId,
              campaignName: insight.campaignName,
              date: new Date(insight.date),
              impressions: insight.impressions,
              clicks: insight.clicks,
              spend: insight.spend,
            },
          });
          upserted++;
        }

        log.info({ clinicId: clinic.id, upserted }, "rows upserted");
      } catch (err) {
        if (err instanceof MetaApiError && err.isAuthError) {
          log.error("Auth error for clinic ${clinic.id}, clearing token");
          await prisma.clinic.update({
            where: { id: clinic.id },
            data: { metaAccessToken: null, metaTokenExpiresAt: null },
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
