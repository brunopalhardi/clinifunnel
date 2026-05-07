import { describe, it, expect } from "vitest";
import { parseProfessionalMap, resolveProfessionalId } from "./professional-map";

describe("parseProfessionalMap", () => {
  it("returns empty object for null/undefined/empty", () => {
    expect(parseProfessionalMap(null)).toEqual({});
    expect(parseProfessionalMap(undefined)).toEqual({});
    expect(parseProfessionalMap({})).toEqual({});
  });

  it("returns empty object for non-object values", () => {
    expect(parseProfessionalMap("string")).toEqual({});
    expect(parseProfessionalMap(123)).toEqual({});
    expect(parseProfessionalMap([])).toEqual({});
  });

  it("keeps numeric ids", () => {
    expect(parseProfessionalMap({ "Dra. Alexia": 12345, "Dr. Joao": 67890 })).toEqual({
      "Dra. Alexia": 12345,
      "Dr. Joao": 67890,
    });
  });

  it("coerces numeric strings to numbers", () => {
    expect(parseProfessionalMap({ "Dra. Alexia": "12345" })).toEqual({
      "Dra. Alexia": 12345,
    });
  });

  it("filters out invalid entries (non-numeric, zero, negative)", () => {
    expect(
      parseProfessionalMap({
        valid: 100,
        zero: 0,
        negative: -5,
        text: "hello",
        nulled: null,
      }),
    ).toEqual({ valid: 100 });
  });
});

describe("resolveProfessionalId", () => {
  const map = {
    "Dra. Alexia Duarte": 12345,
    "Dr. Joao Silva": 67890,
  };

  it("returns null for null/undefined/empty input", () => {
    expect(resolveProfessionalId(null, map)).toBe(null);
    expect(resolveProfessionalId(undefined, map)).toBe(null);
    expect(resolveProfessionalId("", map)).toBe(null);
    expect(resolveProfessionalId("   ", map)).toBe(null);
  });

  it("returns numeric value directly when input is already a numeric id", () => {
    expect(resolveProfessionalId("12345", null)).toBe(12345);
    expect(resolveProfessionalId("12345", {})).toBe(12345);
  });

  it("looks up by exact name match", () => {
    expect(resolveProfessionalId("Dra. Alexia Duarte", map)).toBe(12345);
    expect(resolveProfessionalId("Dr. Joao Silva", map)).toBe(67890);
  });

  it("is case insensitive", () => {
    expect(resolveProfessionalId("dra. alexia duarte", map)).toBe(12345);
    expect(resolveProfessionalId("DRA. ALEXIA DUARTE", map)).toBe(12345);
    expect(resolveProfessionalId("Dra. ALEXIA Duarte", map)).toBe(12345);
  });

  it("normalizes whitespace (extra spaces, tabs)", () => {
    expect(resolveProfessionalId("Dra.  Alexia  Duarte", map)).toBe(12345);
    expect(resolveProfessionalId("  Dra. Alexia Duarte  ", map)).toBe(12345);
    expect(resolveProfessionalId("Dra.\tAlexia\tDuarte", map)).toBe(12345);
  });

  it("returns null when name not in map", () => {
    expect(resolveProfessionalId("Dr. Pedro Silva", map)).toBe(null);
  });

  it("returns null when map is empty/null and value is non-numeric", () => {
    expect(resolveProfessionalId("Dra. Alexia", null)).toBe(null);
    expect(resolveProfessionalId("Dra. Alexia", {})).toBe(null);
  });

  it("does not treat non-pure-digit strings as ids", () => {
    expect(resolveProfessionalId("123abc", { "123abc": 999 })).toBe(999);
    expect(resolveProfessionalId("12 34", map)).toBe(null);
  });

  it("rejects negative or zero numeric inputs (looks up as name)", () => {
    expect(resolveProfessionalId("0", map)).toBe(null);
    expect(resolveProfessionalId("-1", map)).toBe(null);
  });
});
