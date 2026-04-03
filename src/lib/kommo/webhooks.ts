import { KommoWebhookPayload } from "./types";

export function parseKommoWebhook(body: string): KommoWebhookPayload {
  const params = new URLSearchParams(body);
  const payload: KommoWebhookPayload = {};

  // Parse lead status changes
  const statusId = params.get("leads[status][0][id]");
  const statusStatusId = params.get("leads[status][0][status_id]");
  const statusPipelineId = params.get("leads[status][0][pipeline_id]");
  const oldStatusId = params.get("leads[status][0][old_status_id]");
  const oldPipelineId = params.get("leads[status][0][old_pipeline_id]");

  if (statusId && statusStatusId) {
    payload.leads = {
      status: [
        {
          id: statusId,
          status_id: statusStatusId,
          pipeline_id: statusPipelineId || "",
          old_status_id: oldStatusId || "",
          old_pipeline_id: oldPipelineId || "",
        },
      ],
    };
  }

  // Parse lead additions
  const addId = params.get("leads[add][0][id]");
  const addStatusId = params.get("leads[add][0][status_id]");
  const addPipelineId = params.get("leads[add][0][pipeline_id]");

  if (addId && addStatusId) {
    if (!payload.leads) payload.leads = {};
    payload.leads.add = [
      {
        id: addId,
        status_id: addStatusId,
        pipeline_id: addPipelineId || "",
      },
    ];
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
