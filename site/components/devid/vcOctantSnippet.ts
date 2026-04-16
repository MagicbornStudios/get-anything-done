import type { RegistryEntry } from "./SectionRegistry";

/** Screen-space octant from pointer delta (y grows downward). */
export type VcOctant = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

const OCTANT_LABELS: Record<VcOctant, string> = {
  N: "north (up)",
  NE: "northeast",
  E: "east (right)",
  SE: "southeast",
  S: "south (down)",
  SW: "southwest",
  W: "west (left)",
  NW: "northwest",
};

/**
 * Classify drag vector into 8 directions. Uses π/4 sectors rotated so
 * diagonals sit on 45° boundaries.
 */
export function classifyOctant(dx: number, dy: number): VcOctant | null {
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return null;
  const angle = Math.atan2(-dy, dx);
  const norm = (angle + 2 * Math.PI) % (2 * Math.PI);
  const idx = Math.floor((norm + Math.PI / 8) / (Math.PI / 4)) % 8;
  const order: VcOctant[] = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
  return order[idx] ?? "E";
}

export function octantLongLabel(o: VcOctant): string {
  return OCTANT_LABELS[o];
}

export function radiusBandLabel(px: number): "tight" | "medium" | "long" {
  if (px < 72) return "tight";
  if (px < 160) return "medium";
  return "long";
}

/**
 * Single-line handoff fragment: source-search literals in backticks (gad-186).
 */
export function buildVcSpatialHandoffSnippet(
  entries: RegistryEntry[],
  octant: VcOctant,
  radiusPx: number,
): string {
  const hints = entries.map((e) => e.searchHint ?? `data-cid="${e.cid}"`).join("; ");
  const band = radiusBandLabel(radiusPx);
  const r = Math.round(radiusPx / 8) * 8;
  return (
    `[VC spatial] Targets: ${hints}. ` +
    `Gesture from panel anchor: direction **${octant}** (${octantLongLabel(octant)}), ` +
    `reach ~${r}px (${band} band). Prefer edits toward that side of the anchored region in the viewport.`
  );
}
