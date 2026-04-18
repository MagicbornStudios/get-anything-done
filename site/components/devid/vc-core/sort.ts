/**
 * Stable sort for Visual Context registry entries. Pure (no DOM, no React),
 * shared by every adapter so panel ordering stays identical across renderers.
 *
 * Sort key: (depth ascending, original-registration-order ascending). Ties on
 * depth fall back to insertion order — users expect registry rows to match
 * the mount order of the source file.
 */

import type { VcRegistryEntry } from "./types";

export function sortRegistryEntries<T extends VcRegistryEntry>(entries: T[]): T[] {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.depth !== b.entry.depth) return a.entry.depth - b.entry.depth;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}
