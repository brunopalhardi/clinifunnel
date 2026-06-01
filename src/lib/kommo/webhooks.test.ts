import { describe, it, expect } from "vitest";
import { parseKommoWebhook } from "./webhooks";

// Helper: monta o body URL-encoded igual o Kommo envia (form-urlencoded).
function enc(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

describe("parseKommoWebhook", () => {
  it("parses a single status change", () => {
    const body = enc({
      "account[id]": "34328127",
      "account[subdomain]": "clinicaalexiaduarte",
      "leads[status][0][id]": "14764474",
      "leads[status][0][status_id]": "82505867",
      "leads[status][0][pipeline_id]": "10755863",
      "leads[status][0][old_status_id]": "87208107",
    });
    const out = parseKommoWebhook(body);
    expect(out.account?.subdomain).toBe("clinicaalexiaduarte");
    expect(out.leads?.status).toHaveLength(1);
    expect(out.leads?.status?.[0]).toMatchObject({
      id: "14764474",
      status_id: "82505867",
      pipeline_id: "10755863",
      old_status_id: "87208107",
    });
  });

  it("CAP-12: parses ALL batched status changes, not just index [0]", () => {
    // Regressao: o Kommo agrupa varios eventos num POST. Antes so liamos [0],
    // entao um agendamento no indice [1] era descartado silenciosamente.
    const body = enc({
      "account[id]": "34328127",
      "account[subdomain]": "clinicaalexiaduarte",
      "leads[status][0][id]": "111",
      "leads[status][0][status_id]": "87208107",
      "leads[status][0][pipeline_id]": "10755863",
      "leads[status][1][id]": "222",
      "leads[status][1][status_id]": "82505867",
      "leads[status][1][pipeline_id]": "10755863",
      "leads[status][2][id]": "333",
      "leads[status][2][status_id]": "105941116",
      "leads[status][2][pipeline_id]": "10755863",
    });
    const out = parseKommoWebhook(body);
    expect(out.leads?.status).toHaveLength(3);
    expect(out.leads?.status?.map((s) => s.id)).toEqual(["111", "222", "333"]);
    expect(out.leads?.status?.map((s) => s.status_id)).toEqual([
      "87208107",
      "82505867",
      "105941116",
    ]);
  });

  it("parses multiple lead additions", () => {
    const body = enc({
      "account[subdomain]": "clinicaalexiaduarte",
      "leads[add][0][id]": "900",
      "leads[add][0][status_id]": "82474043",
      "leads[add][0][pipeline_id]": "10755863",
      "leads[add][1][id]": "901",
      "leads[add][1][status_id]": "82474043",
      "leads[add][1][pipeline_id]": "10755863",
    });
    const out = parseKommoWebhook(body);
    expect(out.leads?.add).toHaveLength(2);
    expect(out.leads?.add?.map((a) => a.id)).toEqual(["900", "901"]);
  });

  it("parses add + status together", () => {
    const body = enc({
      "account[subdomain]": "clinicaalexiaduarte",
      "leads[add][0][id]": "900",
      "leads[add][0][status_id]": "82474043",
      "leads[add][0][pipeline_id]": "10755863",
      "leads[status][0][id]": "222",
      "leads[status][0][status_id]": "82505867",
      "leads[status][0][pipeline_id]": "10755863",
    });
    const out = parseKommoWebhook(body);
    expect(out.leads?.add).toHaveLength(1);
    expect(out.leads?.status).toHaveLength(1);
  });

  it("returns empty leads when there are no lead events", () => {
    const body = enc({
      "account[id]": "34328127",
      "account[subdomain]": "clinicaalexiaduarte",
    });
    const out = parseKommoWebhook(body);
    expect(out.account?.subdomain).toBe("clinicaalexiaduarte");
    expect(out.leads).toBeUndefined();
  });
});
