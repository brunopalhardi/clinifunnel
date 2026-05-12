import { describe, it, expect, beforeEach } from "vitest";
import { getStoredTheme, setStoredTheme, resolveTheme, STORAGE_KEY } from "./theme";

describe("theme helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getStoredTheme", () => {
    it('retorna "system" quando nada foi salvo', () => {
      expect(getStoredTheme()).toBe("system");
    });

    it("retorna o valor salvo quando valido", () => {
      localStorage.setItem(STORAGE_KEY, "dark");
      expect(getStoredTheme()).toBe("dark");
    });

    it('retorna "system" quando o valor salvo eh invalido', () => {
      localStorage.setItem(STORAGE_KEY, "azul");
      expect(getStoredTheme()).toBe("system");
    });
  });

  describe("setStoredTheme", () => {
    it("salva o modo em localStorage", () => {
      setStoredTheme("dark");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    });

    it('remove do storage ao salvar "system"', () => {
      localStorage.setItem(STORAGE_KEY, "dark");
      setStoredTheme("system");
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("resolveTheme", () => {
    it('retorna "light" pra modo light', () => {
      expect(resolveTheme("light", () => false)).toBe("light");
    });

    it('retorna "dark" pra modo dark', () => {
      expect(resolveTheme("dark", () => true)).toBe("dark");
    });

    it('resolve "system" usando o matcher de prefers-color-scheme', () => {
      expect(resolveTheme("system", () => true)).toBe("dark");
      expect(resolveTheme("system", () => false)).toBe("light");
    });
  });
});
