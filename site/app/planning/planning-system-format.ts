export function planningFmtCount(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString();
}

/** Compact display for large token counts in tight layouts; pair with `title={planningFmtCount(n)}` for full value. */
export function planningFmtCompactCount(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function planningFmtPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
