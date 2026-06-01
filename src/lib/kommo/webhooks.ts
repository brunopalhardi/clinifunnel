import { KommoWebhookPayload } from "./types";

export function parseKommoWebhook(body: string): KommoWebhookPayload {
  const params = new URLSearchParams(body);
  const payload: KommoWebhookPayload = {};

  // Parse lead status changes. O Kommo agrupa varios eventos num unico POST
  // (leads[status][0], leads[status][1], ...). Antes so liamos o indice [0],
  // entao qualquer mudanca de stage agrupada apos a primeira era descartada
  // silenciosamente. Iteramos todos os indices ate nao achar mais.
  const statusChanges: NonNullable<KommoWebhookPayload["leads"]>["status"] = [];
  for (let i = 0; ; i++) {
    const id = params.get(`leads[status][${i}][id]`);
    const statusStatusId = params.get(`leads[status][${i}][status_id]`);
    if (!id || !statusStatusId) break;
    statusChanges.push({
      id,
      status_id: statusStatusId,
      pipeline_id: params.get(`leads[status][${i}][pipeline_id]`) || "",
      old_status_id: params.get(`leads[status][${i}][old_status_id]`) || "",
      old_pipeline_id: params.get(`leads[status][${i}][old_pipeline_id]`) || "",
    });
  }
  if (statusChanges.length) {
    payload.leads = { status: statusChanges };
  }

  // Parse lead additions (idem: todos os indices).
  const adds: NonNullable<KommoWebhookPayload["leads"]>["add"] = [];
  for (let i = 0; ; i++) {
    const id = params.get(`leads[add][${i}][id]`);
    const addStatusId = params.get(`leads[add][${i}][status_id]`);
    if (!id || !addStatusId) break;
    adds.push({
      id,
      status_id: addStatusId,
      pipeline_id: params.get(`leads[add][${i}][pipeline_id]`) || "",
    });
  }
  if (adds.length) {
    if (!payload.leads) payload.leads = {};
    payload.leads.add = adds;
  }

  // Parse account info
  const accountId = params.get("account[id]");
  const subdomain = params.get("account[subdomain]");

  if (accountId) {
    payload.account = {
      id: accountId,
      subdomain: subdomain || "",
    };
  }

  return payload;
}
