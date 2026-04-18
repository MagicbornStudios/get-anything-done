/**
 * `@vc-dom/scan` — DOM-level Visual Context discovery. Framework-agnostic:
 * the only runtime dependencies are `document` and `CSS.escape`, so any
 * vanilla HTML page (or Kaplay/Phaser canvas wrapped in a DOM overlay) that
 * emits `data-cid` attributes can be scanned with zero React in the picture.
 *
 * This file is `"use client"`-free on purpose: the Next app imports it from
 * components that already carry that directive.
 */

import type { VcRegistryEntry } from "../vc-core";

/** CSS-safe escape for interpolating a cid into a selector. */
export function escapeCidSelector(cid: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(cid)
    : cid.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Locate the element carrying a given `data-cid`, or `null`. */
export function queryByCid(cid: string): HTMLElement | null {
  return document.querySelector(`[data-cid="${escapeCidSelector(cid)}"]`) as HTMLElement | null;
}

/**
 * Build a registry entry from a DOM element that carries the `data-cid*` set.
 * Returns `null` when the node has no cid; callers use `fallback` for the
 * outermost scope node that may not carry its own `data-cid` yet.
 */
export function readEntryFromElement(
  node: HTMLElement,
  depth: number,
  fallback?: Partial<VcRegistryEntry>,
): VcRegistryEntry | null {
  const cid = node.getAttribute("data-cid") ?? fallback?.cid ?? "";
  if (!cid) return null;
  return {
    cid,
    label: node.getAttribute("data-cid-label") ?? fallback?.label ?? cid,
    depth,
    componentTag:
      (node.getAttribute("data-cid-component-tag") as VcRegistryEntry["componentTag"] | null) ??
      fallback?.componentTag,
    searchHint: node.getAttribute("data-cid-search") ?? fallback?.searchHint,
  };
}

/**
 * Walk a DOM scope and collect every `[data-cid]` landmark under it, computing
 * nesting depth relative to the scope. Dedups by cid.
 *
 * Works on ANY HTML — the React adapter just happens to emit these attributes
 * via `<Identified>`. A Kaplay / Phaser game that wraps its canvas in a DOM
 * overlay can emit the same attributes and get the same registry.
 */
export function collectScopedEntries(
  scope: HTMLElement | null,
  options?: {
    includeScope?: boolean;
    fallbackRoot?: Partial<VcRegistryEntry>;
  },
): VcRegistryEntry[] {
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
    .filter((entry): entry is VcRegistryEntry => entry != null);
  const minDepth = withDepth.length > 0 ? Math.min(...withDepth.map((e) => e.depth)) : 0;
  const dedup = new Map<string, VcRegistryEntry>();
  for (const entry of withDepth) {
    if (!entry.cid || dedup.has(entry.cid)) continue;
    dedup.set(entry.cid, { ...entry, depth: Math.max(0, entry.depth - minDepth) });
  }
  return Array.from(dedup.values());
}
