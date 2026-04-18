/**
 * Barrel for the Visual Context chord subsystem. Everything chord-related —
 * the pure type + helper functions, the `useSyncExternalStore`-backed global
 * store, and the per-panel consolidation context — lives in this folder and
 * is consumed through this barrel.
 *
 * Importers should use `import { usePanelChord, … } from "./vc-chord"` (or
 * `@/components/devid/vc-chord`); the individual files are an implementation
 * detail and may be split / renamed without touching consumers.
 *
 * Two layers, by intended use:
 *
 * - **Framework-agnostic core (`modifiers.ts`)** — plain TS, zero React, zero
 *   DOM assumptions beyond `KeyboardEvent`. Safe to port to `@gad/vc-core`
 *   verbatim when Bundle C lands.
 * - **React bindings (`store.ts`, `panel-context.tsx`)** — wraps the core with
 *   `useSyncExternalStore` and a panel-scoped context. Porting target is
 *   `@gad/vc-react`.
 */

export {
  VC_CHORD_IDLE,
  attachVcChordGlobalListeners,
  readChordFromEvent,
  type VcChordModifiers,
} from "./modifiers";

export {
  classifyChord,
  resolveVcScreenshotChordMode,
  vcChordIsOuterDeleteHeld,
  vcChordIsOuterUpdateHeld,
  vcChordShowsDeleteMediaPair,
  vcChordShowsUpdateMediaPair,
  type ChordLane,
  type VcScreenshotChordMode,
} from "./lane-rules";

export { peekVcChord, useVcChord } from "./store";

export {
  PanelChordProvider,
  usePanelChord,
  type PanelChordValue,
} from "./panel-context";
