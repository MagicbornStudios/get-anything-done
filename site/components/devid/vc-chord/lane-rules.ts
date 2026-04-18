/**
 * Lane rules — single source of truth for "what does this modifier chord mean
 * for the Visual Context UI?"
 *
 * Before this file, each consumer imported a named boolean selector
 * (`vcChordShowsUpdateMediaPair`, `vcChordIsOuterDeleteHeld`, …) and re-checked
 * the modifier combination itself. Multiple selectors tested the same chord
 * (`ctrl && !alt && !shift` was both "delete row shows media" AND "update
 * button switches to outer lane"), so semantics were scattered and easy to
 * drift. Adding a new lane meant editing ~5 callers.
 *
 * Now there is **one classifier** — `classifyChord(m)` — that returns a
 * canonical `ChordLane` name. Every affordance is a trivial lookup on that
 * lane. Adding a new chord/lane is one line here plus one mapping row per
 * affordance.
 *
 * This file is intentionally UX-policy: it does not read DOM, does not
 * subscribe to anything, does not import React. It is the layer that maps
 * raw modifier state to "what the user asked for." Safe to port to
 * `@gad/vc-core` as-is.
 */

import type { VcChordModifiers } from "./modifiers";

/**
 * Canonical names for the modifier sets we treat specially. Anything not
 * explicitly listed collapses to `"idle"` — the default "no chord" behavior.
 *
 * Ordered roughly by frequency of use:
 *
 * - `idle`         — no modifiers, default affordances
 * - `alt`          — Alt alone, update lane shows media / delete targets outer
 * - `ctrl`         — Ctrl|Cmd alone, delete lane shows media / update targets outer
 * - `ctrlShift`    — Ctrl|Cmd + Shift, screenshot button switches to "pick folder"
 * - `altCtrl`      — both held, rarely used (reserved for future "compose" chord)
 * - `shift` / `altShift` / `ctrlAltShift` — currently idle semantics.
 */
export type ChordLane =
  | "idle"
  | "alt"
  | "ctrl"
  | "shift"
  | "altCtrl"
  | "altShift"
  | "ctrlShift"
  | "altCtrlShift";

export function classifyChord(m: VcChordModifiers): ChordLane {
  const { alt, ctrl, shift } = m;
  if (alt && ctrl && shift) return "altCtrlShift";
  if (alt && ctrl) return "altCtrl";
  if (alt && shift) return "altShift";
  if (ctrl && shift) return "ctrlShift";
  if (alt) return "alt";
  if (ctrl) return "ctrl";
  if (shift) return "shift";
  return "idle";
}

/** PNG strip: Ctrl+Shift → Dir, Ctrl → Pick (media), Alt → Upd, else PNG. */
export type VcScreenshotChordMode = "png" | "dir" | "media" | "upd";

export function resolveVcScreenshotChordMode(m: VcChordModifiers): VcScreenshotChordMode {
  switch (classifyChord(m)) {
    case "ctrlShift":
      return "dir";
    case "ctrl":
      return "media";
    case "alt":
      return "upd";
    default:
      return "png";
  }
}

/**
 * Update row: Mic + image "Upd" affordance when the user is holding Alt alone.
 * Returns true for the same chord that flips the Del button's media pair off.
 */
export function vcChordShowsUpdateMediaPair(m: VcChordModifiers): boolean {
  return classifyChord(m) === "alt";
}

/**
 * Delete row: Trash + media hint when Ctrl|Cmd is held alone (storage-delete copy).
 */
export function vcChordShowsDeleteMediaPair(m: VcChordModifiers): boolean {
  return classifyChord(m) === "ctrl";
}

/**
 * Outer-update lane affordance on the target-bound Upd button: Ctrl|Cmd held
 * alone switches the upcoming update prompt to the outer (surrounding
 * neighborhood) variant, using the current target as the anchor. Shares the
 * same chord as `vcChordShowsDeleteMediaPair` — both views are valid
 * simultaneously because they paint different buttons.
 */
export function vcChordIsOuterUpdateHeld(m: VcChordModifiers): boolean {
  return classifyChord(m) === "ctrl";
}

/**
 * Outer-delete lane affordance on the target-bound Del button: Alt held alone
 * switches the delete prompt to remove the unidentified surrounding sections
 * around the anchor. Shares the same chord as `vcChordShowsUpdateMediaPair`.
 */
export function vcChordIsOuterDeleteHeld(m: VcChordModifiers): boolean {
  return classifyChord(m) === "alt";
}
