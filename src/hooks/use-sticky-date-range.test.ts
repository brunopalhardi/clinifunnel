import { describe, it, expect, beforeEach } from "vitest";
import { readStoredPreset, writeStoredPreset, STORAGE_KEY } from "./use-sticky-date-range";

describe("useStickyDateRange helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("readStoredPreset", () => {
    it("retorna o fallback quando nada foi salvo", () => {
      expect(readStoredPreset("30d")).toBe("30d");
    });

    it("retorna o valor salvo quando valido", () => {
      localStorage.setItem(STORAGE_KEY, "7d");
      expect(readStoredPreset("30d")).toBe("7d");
    });

    it("retorna o fallback quando o valor salvo eh invalido", () => {
      localStorage.setItem(STORAGE_KEY, "trimestre");
      expect(readStoredPreset("30d")).toBe("30d");
    });

    it("aceita todos os presets validos", () => {
      const validos = ["today", "yesterday", "7d", "30d", "90d", "thisMonth", "lastMonth"] as const;
      for (const p of validos) {
        localStorage.setItem(STORAGE_KEY, p);
        expect(readStoredPreset("30d")).toBe(p);
      }
    });
  });

  describe("writeStoredPreset", () => {
    it("salva preset valido no localStorage", () => {
      writeStoredPreset("7d");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("7d");
    });

    it("ignora null e preserva valor anterior", () => {
      localStorage.setItem(STORAGE_KEY, "7d");
      writeStoredPreset(null);
      expect(localStorage.getItem(STORAGE_KEY)).toBe("7d");
    });

    it("ignora valores invalidos e preserva valor anterior", () => {
      localStorage.setItem(STORAGE_KEY, "7d");
      writeStoredPreset("foo");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("7d");
    });
  });

  describe("integracao do fluxo sticky", () => {
    // Regressao da v0.44.0: na primeira render o DateFilter disparava
    // onFilter com fallback antes do hook ler o storage, sobrescrevendo
    // o stored. A leitura sincrona via lazy useState evita esse race.
    it("save apos read preserva o valor original do storage", () => {
      // User entrou na pagina antes com "7d" salvo.
      localStorage.setItem(STORAGE_KEY, "7d");

      // Mount: hook le sincronicamente — recebe "7d".
      const onMount = readStoredPreset("30d");
      expect(onMount).toBe("7d");

      // DateFilter dispara onFilter com o preset que recebeu (= "7d"),
      // que chama save("7d"). Idempotente — storage continua "7d".
      writeStoredPreset(onMount);
      expect(localStorage.getItem(STORAGE_KEY)).toBe("7d");

      // Navega pra outra pagina: novo mount, mesma leitura.
      expect(readStoredPreset("30d")).toBe("7d");
    });
  });
});
