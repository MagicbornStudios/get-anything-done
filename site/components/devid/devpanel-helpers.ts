/**
 * Pure helpers lifted out of `DevPanel.tsx` to keep the main component focused
 * on render + state wiring. These are framework-independent apart from
 * touching the DOM (scroll / query / focus), so they're safe to unit-test and
 * easy to port — the `collectBandEntriesWithPortals` function in particular
 * is the integration point between the section DOM and any Radix-portaled
 * dialogs that share the same `data-devid-band` attribute.
 */

import type { RegistryEntry } from "./SectionRegistry";
import {
  collectScopedEntries,
  escapeCidSelector,
  queryByCid,
  sortRegistryEntries,
} from "./devid-dom-scan";

/**
 * Resolve a cid list against a pool of registry entries, preserving the
 * input order and silently dropping unknown cids. Used when the selection
 * state references entries that may have since unmounted.
 */
export function resolveEntriesOrdered(
  pool: RegistryEntry[],
  cids: readonly string[],
): RegistryEntry[] {
  return cids
    .map((c) => pool.find((e) => e.cid === c))
    .filter((e): e is RegistryEntry => Boolean(e));
}

/**
 * Ordered merge list for handoff when ≥2 cids selected at the current depth
 * slice. Falls back to `[clicked]` if the merge list contains fewer than two
 * still-visible entries.
 */
export function resolveHandoffEntries(
  clicked: RegistryEntry,
  visible: RegistryEntry[],
  mergeCids: readonly string[],
): RegistryEntry[] {
  const ordered = mergeCids
    .filter((c) => visible.some((e) => e.cid === c))
    .map((c) => visible.find((e) => e.cid === c)!)
    .filter((e): e is RegistryEntry => Boolean(e));
  if (ordered.length >= 2) return ordered;
  return [clicked];
}

/**
 * Scrolls a cid into the viewport with a soft focus + flash. No-op when the
 * element isn't on the page. Returning early avoids touching `tabindex` on
 * unrelated nodes.
 */
export function locateComponentOnPage(
  cid: string,
  flashComponent: (cid: string) => void,
) {
  const el = queryByCid(cid);
  if (!el) return;
  const hadTab = el.hasAttribute("tabindex");
  if (!hadTab) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  flashComponent(cid);
  window.setTimeout(() => {
    if (!hadTab) el.removeAttribute("tabindex");
  }, 1400);
}

/**
 * Open Radix dialogs portaled to `body` are outside the section DOM; merge
 * by `data-devid-band`. Returns a sorted, de-duplicated list of entries
 * found under the section scope plus any portaled dialog scopes that
 * declare the same band.
 */
export function collectBandEntriesWithPortals(
  bandCid: string,
  bandLabel: string,
  bandComponentTag: RegistryEntry["componentTag"] | undefined,
  bandSearchHint: string | undefined,
): RegistryEntry[] {
  const scope = queryByCid(bandCid);
  const fromSection = collectScopedEntries(scope, {
    includeScope: true,
    fallbackRoot: {
      cid: bandCid,
      label: bandLabel,
      depth: 0,
      componentTag: bandComponentTag,
      searchHint: bandSearchHint,
    },
  });
  if (typeof document === "undefined") return fromSection;

  /**
   * Radix Content may not expose `role="dialog"` on the same node as our
   * attrs in all versions — match by band + open state only.
   */
  let dialogRoots: HTMLElement[];
  try {
    dialogRoots = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-devid-band="${escapeCidSelector(bandCid)}"]`,
      ),
    ).filter((el) => el.getAttribute("data-state") === "open");
  } catch {
    return fromSection;
  }

  const fromDialogs: RegistryEntry[] = [];
  for (const root of dialogRoots) {
    fromDialogs.push(...collectScopedEntries(root, { includeScope: false }));
  }

  const merged = new Map<string, RegistryEntry>();
  for (const e of fromDialogs) merged.set(e.cid, e);
  for (const e of fromSection) merged.set(e.cid, e);
  return sortRegistryEntries(Array.from(merged.values()));
}
