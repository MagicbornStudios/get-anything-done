/**
 * Single source of truth for every keyboard shortcut the DevId system
 * exposes. Two consumers read this file:
 *
 * 1. The `?` cheatsheet modal (`KeyboardShortcuts.tsx`) — renders the `keys`
 *    + `label` + optional `when` text into a styled list.
 * 2. The DevId keyboard handler (`DevIdProvider.tsx`) — uses `matchShortcut`
 *    to test a live `KeyboardEvent` against the declared key combo instead
 *    of duplicating the key-comparison logic inline.
 *
 * Previously both files hardcoded the keys independently, so the cheatsheet
 * and the actual behavior could drift silently. Adding a new shortcut now
 * means adding one entry here; both surfaces pick it up automatically.
 *
 * The registry is data-only — no handlers live here. The provider owns the
 * imperative side effects because they need direct closure access to the
 * selection setters; forcing that through the registry would just add
 * indirection without saving any lines.
 */

export type ShortcutKind = "devid" | "global" | "debug";

export interface ShortcutDescriptor {
  /** Stable id. Used by the provider to look up the descriptor when matching. */
  id: string;
  /** Pretty tokens shown in the cheatsheet. Order matters. */
  keys: string[];
  /** One-line description of what the shortcut does. */
  label: string;
  /** Optional qualifier rendered in a muted tag ("when dev-ids on", etc.). */
  when?: string;
  /** Category used to group / filter in the cheatsheet. */
  kind: ShortcutKind;
  /** When true, handler only fires while DevIds are enabled. */
  requiresEnabled?: boolean;
  /** When true, the shortcut is allowed while the user is typing in an input. */
  allowInEditable?: boolean;
  /** Only present for entries that gate on a runtime flag (e.g. client debug env). */
  gate?: "client-debug";
}

const CLIENT_DEBUG_ON =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_CLIENT_DEBUG === "1";

/**
 * Raw registry. `getVisibleShortcuts()` filters out entries whose gate is
 * currently inactive (e.g. the client-debug dock toggle hides unless
 * `NEXT_PUBLIC_CLIENT_DEBUG=1`). Runtime matching uses `matchShortcut` so
 * we don't duplicate the key-compare logic across call sites.
 */
const SHORTCUTS: readonly ShortcutDescriptor[] = [
  {
    id: "cheatsheet.toggle",
    keys: ["?"],
    label: "Open this keyboard shortcut reference",
    kind: "global",
    allowInEditable: false,
  },
  {
    id: "devid.toggle",
    keys: ["Alt", "I"],
    label: "Toggle component IDs overlay",
    kind: "devid",
  },
  {
    id: "devid.altClick",
    keys: ["Alt", "click"],
    label: "Copy component ID + highlight (when DevIds on)",
    kind: "devid",
    requiresEnabled: true,
  },
  {
    id: "devid.search",
    keys: ["Alt", "K"],
    label: "Toggle the component search dialog",
    kind: "devid",
    requiresEnabled: true,
  },
  {
    id: "devid.resetAltMerge",
    keys: ["Alt", "D"],
    label: "Collapse the Alt merge lane to the primary highlight",
    kind: "devid",
    requiresEnabled: true,
  },
  {
    id: "devid.clearCtrlLane",
    keys: ["Ctrl", "D"],
    label: "Clear the Ctrl reference lane",
    kind: "devid",
    requiresEnabled: true,
  },
  {
    id: "debug.dock",
    keys: ["Alt", "Shift", "D"],
    label: "Show / hide client debug dock (remembers for this browser)",
    when: "when NEXT_PUBLIC_CLIENT_DEBUG=1",
    kind: "debug",
    gate: "client-debug",
  },
  {
    id: "devid.escape",
    keys: ["Esc"],
    label: "Close panels / clear highlight / close this sheet",
    kind: "global",
    allowInEditable: true,
  },
];

/** Filters gated entries (e.g. hides the client-debug row unless enabled). */
export function getVisibleShortcuts(): ShortcutDescriptor[] {
  return SHORTCUTS.filter((s) => {
    if (s.gate === "client-debug") return CLIENT_DEBUG_ON;
    return true;
  });
}

/** Lookup a descriptor by id. Throws in dev if the id is unknown. */
export function getShortcut(id: string): ShortcutDescriptor {
  const found = SHORTCUTS.find((s) => s.id === id);
  if (!found) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[devid] unknown shortcut id: ${id}`);
    }
    return { id, keys: [], label: "", kind: "global" };
  }
  return found;
}

/**
 * Match a live `KeyboardEvent` against a shortcut descriptor by id.
 *
 * Keeps key-compare logic in one place and is forgiving about case / aliases
 * (letters match case-insensitively; `"?"` matches either the `"?"` key or
 * `"Shift" + "/"`; `"Esc"` matches `"Escape"`; `"Ctrl"` matches Control or
 * Meta so Mac users don't get left out).
 */
export function matchShortcut(e: KeyboardEvent, id: string): boolean {
  const spec = getShortcut(id);
  if (spec.keys.length === 0) return false;

  /** Collect required modifiers from the descriptor. */
  let needAlt = false;
  let needCtrl = false;
  let needShift = false;
  let primaryKey: string | null = null;
  for (const tok of spec.keys) {
    const low = tok.toLowerCase();
    if (low === "alt") needAlt = true;
    else if (low === "ctrl" || low === "control" || low === "cmd" || low === "meta") needCtrl = true;
    else if (low === "shift") needShift = true;
    else if (low === "click") return false; // click-based shortcuts don't match keyboard
    else primaryKey = tok; // last non-modifier token wins
  }

  /** Only test modifier parity if the descriptor used modifier tokens. */
  if (needAlt !== e.altKey) return false;
  if (needCtrl !== (e.ctrlKey || e.metaKey)) return false;

  const key = e.key;

  if (!primaryKey) return false;
  const lowKey = key.toLowerCase();
  const lowPrimary = primaryKey.toLowerCase();

  if (lowPrimary === "esc" || lowPrimary === "escape") {
    return key === "Escape";
  }

  if (lowPrimary === "?") {
    if (key === "?") return true;
    return e.shiftKey && key === "/";
  }

  /**
   * For plain letter/digit primaries, match the `e.key` case-insensitively.
   * Shift parity is only enforced when the descriptor explicitly lists Shift.
   */
  if (lowKey !== lowPrimary) return false;
  if (needShift && !e.shiftKey) return false;
  return true;
}
