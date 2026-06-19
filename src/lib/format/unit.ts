export function formatUnitDisplay(unit: string | null | undefined): string {
  if (!unit || unit.trim().length === 0) return "—";

  // Normalize by converting to lowercase and collapsing multiple spaces
  const normalized = unit.trim().toLowerCase().replace(/\s+/g, " ");

  if (["mét khối", "met khoi", "m3", "m³", "khối", "khoi"].includes(normalized)) {
    return "m³";
  }

  if (["mét vuông", "met vuong", "m2", "m²"].includes(normalized)) {
    return "m²";
  }

  return unit.trim();
}
