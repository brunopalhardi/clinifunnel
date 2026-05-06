import { describe, expect, it } from "vitest";
import { classifyChannel, hasUTMs, utmsToNote, utmsToTags } from "./utm";

describe("hasUTMs", () => {
  it("true se qualquer campo utm preenchido", () => {
    expect(hasUTMs({ utmSource: "google" })).toBe(true);
    expect(hasUTMs({ utmMedium: "cpc" })).toBe(true);
    expect(hasUTMs({ utmCampaign: "x" })).toBe(true);
    expect(hasUTMs({ utmContent: "x" })).toBe(true);
    expect(hasUTMs({ utmTerm: "x" })).toBe(true);
  });

  it("false se todos vazios/undefined", () => {
    expect(hasUTMs({})).toBe(false);
    expect(hasUTMs({ utmSource: undefined, utmMedium: undefined })).toBe(false);
    expect(hasUTMs({ utmSource: "" })).toBe(false);
  });
});

describe("classifyChannel", () => {
  it("'campaign' quando tem UTM", () => {
    expect(classifyChannel({ utmSource: "google" })).toBe("campaign");
  });

  it("'organic' quando nao tem UTM", () => {
    expect(classifyChannel({})).toBe("organic");
  });
});

describe("utmsToTags", () => {
  it("formato 'key:value' por campo presente", () => {
    expect(
      utmsToTags({ utmSource: "google", utmMedium: "cpc" }),
    ).toEqual(["source:google", "medium:cpc"]);
  });

  it("array vazio se sem UTMs", () => {
    expect(utmsToTags({})).toEqual([]);
  });
});

describe("utmsToNote", () => {
  it("inclui 'Canal:' quando canalProspeccao fornecido", () => {
    const note = utmsToNote(
      { utmSource: "google" },
      "Indicacao",
    );
    expect(note).toContain("Canal: Indicacao");
    expect(note).toContain("Source: google");
  });

  it("string vazia se sem UTMs e sem canal", () => {
    expect(utmsToNote({})).toBe("");
  });

  it("prefixo [CliniFunnel] quando ha algum dado", () => {
    expect(utmsToNote({ utmSource: "x" })).toMatch(/^\[CliniFunnel\]/);
  });
});
