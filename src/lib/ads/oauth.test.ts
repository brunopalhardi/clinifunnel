import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateOAuthState, verifyOAuthState } from "./oauth";

describe("OAuth state HMAC anti-CSRF", () => {
  it("round-trip: verifica state recem-gerado e devolve clinicId", () => {
    const state = generateOAuthState("clinic-abc");
    expect(verifyOAuthState(state)).toBe("clinic-abc");
  });

  it("formato 'clinicId.timestamp.signature' com 3 partes separadas por ponto", () => {
    const state = generateOAuthState("clinic-x");
    const parts = state.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("clinic-x");
  });

  it("retorna null se signature foi modificada (tampering)", () => {
    const state = generateOAuthState("clinic-y");
    const tampered = state.slice(0, -1) + "0"; // troca ultimo char da signature
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("retorna null se clinicId foi modificado (signature mismatch)", () => {
    const state = generateOAuthState("clinic-a");
    const parts = state.split(".");
    const swapped = `clinic-b.${parts[1]}.${parts[2]}`;
    expect(verifyOAuthState(swapped)).toBeNull();
  });

  it("retorna null se formato invalido (poucos componentes)", () => {
    expect(verifyOAuthState("foo.bar")).toBeNull();
    expect(verifyOAuthState("not-a-state")).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
  });

  describe("expiracao", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("aceita state com idade < 10min", () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const state = generateOAuthState("clinic-z");
      vi.setSystemTime(new Date("2026-01-01T00:09:59Z")); // 9min59s depois
      expect(verifyOAuthState(state)).toBe("clinic-z");
    });

    it("rejeita state com idade > 10min", () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const state = generateOAuthState("clinic-z");
      vi.setSystemTime(new Date("2026-01-01T00:10:01Z")); // 10min1s depois
      expect(verifyOAuthState(state)).toBeNull();
    });
  });
});
