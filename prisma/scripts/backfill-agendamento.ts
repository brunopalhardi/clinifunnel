/**
 * [CAP-12] Backfill de `Lead.agendamentoAt` a partir do historico do Kommo.
 *
 * Contexto: por meses o webhook do Kommo perdeu mudancas de stage (429 da API +
 * erro de tipo no upsert), entao leads que entraram em "Agendado" nunca tiveram
 * `agendamentoAt` gravado e a metrica "Consultas agendadas" ficou zerada. O fix
 * do webhook (assincrono + retry) resolve daqui pra frente; este script
 * RECUPERA o passado.
 *
 * Como funciona: le os eventos `lead_status_changed` do Kommo (fonte da verdade)
 * e, pra cada lead que entrou no stage de agendamento da clinica, grava
 * `agendamentoAt = data do evento` (a PRIMEIRA vez que entrou). Reusa
 * processKommoLead com skipPatientCreation=true pra NAO criar agendamentos
 * duplicados no Clinicorp.
 *
 * Uso (rodar no container de workers, que tem acesso ao DB/Redis):
 *   BACKFILL_DRY_RUN=true  npm run backfill-agendamento   # so lista, nao grava
 *   BACKFILL_DAYS=120      npm run backfill-agendamento    # grava (janela 120d)
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { processKommoLead } from "@/lib/kommo/process-lead";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "backfill-agendamento" });

const DAYS = Number(process.env.BACKFILL_DAYS ?? "120");
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
const KOMMO_API_DELAY_MS = 300; // respeita rate-limit (~7 req/s, 2 calls/lead)

interface KommoStatusEvent {
  entity_id: number;
  created_at: number;
  value_after?: Array<{ lead_status?: { id: number; pipeline_id: number } }>;
}

/**
 * Retorna Map<leadId, unixTsDaPrimeiraEntrada> pros leads que entraram no
 * stage de agendamento dentro da janela.
 */
async function fetchFirstAgendadoEntries(
  subdomain: string,
  token: string,
  stageId: string,
  fromUnix: number,
  toUnix: number,
): Promise<Map<number, number>> {
  const first = new Map<number, number>();
  let page = 1;
  while (page <= 100) {
    const q = new URLSearchParams();
    q.append("filter[type][]", "lead_status_changed");
    q.set("filter[created_at][from]", String(fromUnix));
    q.set("filter[created_at][to]", String(toUnix));
    q.set("limit", "250");
    q.set("page", String(page));

    const res = await fetch(`https://${subdomain}.kommo.com/api/v4/events?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) break;
    if (!res.ok) {
      throw new Error(`Kommo events ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { _embedded?: { events?: KommoStatusEvent[] } };
    const events = json._embedded?.events ?? [];
    if (events.length === 0) break;

    for (const e of events) {
      const after = e.value_after?.[0]?.lead_status;
      if (after && String(after.id) === stageId) {
        const prev = first.get(e.entity_id);
        if (prev === undefined || e.created_at < prev) {
          first.set(e.entity_id, e.created_at);
        }
      }
    }
    page++;
    await new Promise((r) => setTimeout(r, 150));
  }
  return first;
}

async function main() {
  const clinics = await prisma.clinic.findMany({
    where: {
      pipelineId: { not: null },
      stageAgendamento: { not: null },
    },
    select: {
      id: true,
      name: true,
      kommoSubdomain: true,
      kommoToken: true,
      pipelineId: true,
      stageAgendamento: true,
    },
  });

  const nowUnix = Math.floor(Date.now() / 1000);
  const fromUnix = nowUnix - DAYS * 86400;
  log.info({ clinics: clinics.length, days: DAYS, dryRun: DRY_RUN }, "backfill iniciado");

  for (const clinic of clinics) {
    const { kommoSubdomain, kommoToken, pipelineId, stageAgendamento } = clinic;
    if (!kommoSubdomain || !kommoToken || !pipelineId || !stageAgendamento) continue;

    const entries = await fetchFirstAgendadoEntries(
      kommoSubdomain,
      kommoToken,
      stageAgendamento,
      fromUnix,
      nowUnix,
    );
    log.info(
      { clinicId: clinic.id, clinic: clinic.name, agendados: entries.size },
      "leads que entraram em Agendado na janela",
    );

    let done = 0;
    let failed = 0;
    for (const [leadId, ts] of Array.from(entries.entries())) {
      const agendamentoAt = new Date(ts * 1000);
      if (DRY_RUN) {
        // eslint-disable-next-line no-console
        console.log(`[dry] lead ${leadId} -> agendamentoAt=${agendamentoAt.toISOString()}`);
        continue;
      }
      try {
        await processKommoLead(
          {
            id: clinic.id,
            kommoSubdomain,
            kommoToken,
            stageAgendamento,
          },
          {
            leadId: String(leadId),
            statusId: stageAgendamento,
            pipelineId,
            agendamentoAtOverride: agendamentoAt,
            skipPatientCreation: true,
          },
        );
        done++;
        await new Promise((r) => setTimeout(r, KOMMO_API_DELAY_MS));
      } catch (err) {
        failed++;
        log.error(
          { leadId, err: err instanceof Error ? err.message : err },
          "falha ao recuperar lead",
        );
      }
    }
    log.info({ clinicId: clinic.id, done, failed }, "backfill concluido pra clinica");
  }

  await prisma.$disconnect();
  log.info("backfill finalizado");
  process.exit(0);
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : err }, "backfill crashou");
  process.exit(1);
});
