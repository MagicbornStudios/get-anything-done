/** Dedupe-merge paths for update/delete handoff lists. */
export function mergeUniqueMediaPaths(previous: string[], add: string[]): string[] {
  if (add.length === 0) return previous;
  const next = [...previous];
  for (const p of add) {
    if (!next.includes(p)) next.push(p);
  }
  return next;
}
