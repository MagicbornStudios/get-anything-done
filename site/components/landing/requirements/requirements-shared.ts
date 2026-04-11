export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export const REQUIREMENTS_VERSION_GRADIENT: Record<string, string> = {
  v1: "from-red-500/20 via-red-500/5 to-transparent border-red-500/30",
  v2: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30",
  v3: "from-sky-500/20 via-sky-500/5 to-transparent border-sky-500/30",
  v4: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30",
};
