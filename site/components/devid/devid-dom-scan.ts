import type { RegistryEntry } from "./SectionRegistry";

export function escapeCidSelector(cid: string) {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(cid)
    : cid.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function queryByCid(cid: string) {
  return document.querySelector(`[data-cid="${escapeCidSelector(cid)}"]`) as HTMLElement | null;
}

export function readEntryFromElement(
  node: HTMLElement,
  depth: number,
  fallback?: Partial<RegistryEntry>,
): RegistryEntry | null {
  const cid = node.getAttribute("data-cid") ?? fallback?.cid ?? "";
  if (!cid) return null;
  return {
    cid,
    label: node.getAttribute("data-cid-label") ?? fallback?.label ?? cid,
    depth,
    componentTag:
      (node.getAttribute("data-cid-component-tag") as RegistryEntry["componentTag"] | null) ??
      fallback?.componentTag,
    searchHint: node.getAttribute("data-cid-search") ?? fallback?.searchHint,
  };
}

export function sortRegistryEntries(entries: RegistryEntry[]): RegistryEntry[] {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.depth !== b.entry.depth) return a.entry.depth - b.entry.depth;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/**
 * Collect `[data-cid]` landmarks under a DOM scope (section, dialog body, etc.).
 */
export function collectScopedEntries(
  scope: HTMLElement | null,
  options?: {
    includeScope?: boolean;
    fallbackRoot?: Partial<RegistryEntry>;
  },
): RegistryEntry[] {
  if (!scope) {
    return options?.fallbackRoot?.cid
      ? [
          {
            cid: options.fallbackRoot.cid,
            label: options.fallbackRoot.label ?? options.fallbackRoot.cid,
            depth: 0,
            componentTag: options.fallbackRoot.componentTag,
            searchHint: options.fallbackRoot.searchHint,
          },
        ]
      : [];
  }
  const nodes = [
    ...(options?.includeScope ? [scope] : []),
    ...Array.from(scope.querySelectorAll<HTMLElement>("[data-cid]")),
  ];
  const withDepth = nodes
    .map((node) => {
      let depth = 0;
      let current: HTMLElement | null = node === scope ? null : node.parentElement;
      while (current) {
        if (scope.contains(current) && current.hasAttribute("data-cid")) depth += 1;
        if (current === scope) break;
        current = current.parentElement;
      }
      return readEntryFromElement(
        node,
        depth,
        node === scope ? options?.fallbackRoot : undefined,
      );
    })
    .filter((entry): entry is RegistryEntry => entry != null);
  const minDepth = withDepth.length > 0 ? Math.min(...withDepth.map((e) => e.depth)) : 0;
  const dedup = new Map<string, RegistryEntry>();
  for (const entry of withDepth) {
    if (!entry.cid || dedup.has(entry.cid)) continue;
    dedup.set(entry.cid, { ...entry, depth: Math.max(0, entry.depth - minDepth) });
  }
  return Array.from(dedup.values());
}
