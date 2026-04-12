export function planningFmtCount(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString();
}

export function planningFmtPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
