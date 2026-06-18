import { describe, expect, it } from "vitest";
import { formatUnitDisplay } from "./unit";

describe("formatUnitDisplay", () => {
  it("formats m3 variants correctly", () => {
    expect(formatUnitDisplay("mét khối")).toBe("m³");
    expect(formatUnitDisplay("Mét Khối ")).toBe("m³");
    expect(formatUnitDisplay("m3")).toBe("m³");
    expect(formatUnitDisplay("m³")).toBe("m³");
    expect(formatUnitDisplay("khối")).toBe("m³");
    expect(formatUnitDisplay("khoi")).toBe("m³");
    expect(formatUnitDisplay("met khoi")).toBe("m³");
    expect(formatUnitDisplay("  mét   khối  ")).toBe("m³");
  });

  it("formats m2 variants correctly", () => {
    expect(formatUnitDisplay("mét vuông")).toBe("m²");
    expect(formatUnitDisplay("met vuong")).toBe("m²");
    expect(formatUnitDisplay("m2")).toBe("m²");
    expect(formatUnitDisplay("m²")).toBe("m²");
  });

  it("keeps other units unchanged", () => {
    expect(formatUnitDisplay("bao")).toBe("bao");
    expect(formatUnitDisplay("cây")).toBe("cây");
    expect(formatUnitDisplay("viên")).toBe("viên");
    expect(formatUnitDisplay(" cái ")).toBe("cái");
  });

  it("handles null, undefined, and empty string", () => {
    expect(formatUnitDisplay(null)).toBe("");
    expect(formatUnitDisplay(undefined)).toBe("");
    expect(formatUnitDisplay("")).toBe("");
    expect(formatUnitDisplay("   ")).toBe("");
  });
});
