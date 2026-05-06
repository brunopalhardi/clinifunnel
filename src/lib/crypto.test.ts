import { describe, expect, it } from "vitest";
import { decrypt, encrypt, isEncrypted } from "./crypto";

describe("crypto: encrypt/decrypt", () => {
  it("round-trip: encrypt(plain) -> decrypt(stored) === plain", () => {
    const plain = "kommo-token-abc123";
    const stored = encrypt(plain)!;
    expect(decrypt(stored)).toBe(plain);
  });

  it("encrypt produz prefixo v1: e formato com 3 partes apos prefixo", () => {
    const stored = encrypt("hello")!;
    expect(stored.startsWith("v1:")).toBe(true);
    const parts = stored.slice(3).split(":");
    expect(parts).toHaveLength(3);
  });

  it("encrypt do mesmo plaintext gera ciphertexts diferentes (IV aleatoria)", () => {
    const a = encrypt("same")!;
    const b = encrypt("same")!;
    expect(a).not.toBe(b);
  });

  it("decrypt(null/undefined/'') retorna null", () => {
    expect(decrypt(null)).toBeNull();
    expect(decrypt(undefined)).toBeNull();
    expect(decrypt("")).toBeNull();
  });

  it("encrypt(null/undefined/'') retorna null", () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeNull();
    expect(encrypt("")).toBeNull();
  });

  it("decrypt sem prefixo v1: retorna como esta (legacy plaintext passthrough)", () => {
    expect(decrypt("plaintext-legacy-token")).toBe("plaintext-legacy-token");
  });

  it("decrypt com formato invalido apos v1: lanca erro", () => {
    expect(() => decrypt("v1:bad")).toThrow();
    expect(() => decrypt("v1:a:b")).toThrow(); // 2 partes em vez de 3
  });

  it("decrypt detecta tampering (auth tag invalida)", () => {
    const stored = encrypt("important-data")!;
    // Modifica 1 char do ciphertext: GCM tag deve falhar a verificacao
    const parts = stored.slice(3).split(":");
    const tampered = `v1:${parts[0]}:${parts[1].slice(0, -2)}AA:${parts[2]}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("isEncrypted true so para valores com prefixo v1:", () => {
    const stored = encrypt("foo")!;
    expect(isEncrypted(stored)).toBe(true);
    expect(isEncrypted("plaintext")).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
  });

  it("preserva strings longas (JWT > 1000 chars)", () => {
    const longJwt = "a".repeat(2000);
    const stored = encrypt(longJwt)!;
    expect(decrypt(stored)).toBe(longJwt);
  });

  it("preserva caracteres unicode", () => {
    const plain = "señor 你好 🎉";
    const stored = encrypt(plain)!;
    expect(decrypt(stored)).toBe(plain);
  });
});
