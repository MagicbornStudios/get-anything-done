/**
 * `@vc-react` — React adapter for the Visual Context system.
 *
 * This barrel is the **public entry point for React consumers**. It re-exports
 * the React-specific bindings built on top of the framework-agnostic
 * `vc-core` / `vc-dom` layers:
 *
 * - Identity: `<Identified>` (styled) + `<IdentifiedPrimitive>` (headless)
 * - Provider: `<DevIdProvider>` + narrow slice hooks
 * - Shortcut registry + matcher
 *
 * The styled DevPanel / BandDevPanel / modal UI is a consumer of this adapter
 * and lives in `components/devid/` at the site layer — it can be split into a
 * `@vc-shadcn` reference package later without touching `vc-react` / `vc-dom`.
 *
 * New consumer code should import from here (`./vc-react`) rather than
 * reaching into individual files, so a future refactor that moves these files
 * into `packages/vc-react/` is a zero-call-site migration.
 */

export { Identified, type IdentifiedProps } from "../Identified";
export {
  IdentifiedPrimitive,
  pickLeafFromEvent,
  readDepthForCid,
  type IdentifiedLeaf,
  type IdentifiedPrimitiveProps,
} from "../IdentifiedPrimitive";
export {
  DevIdProvider,
  useDevId,
  useDevIdEnabled,
  useDevIdSelection,
  useDevIdSettings,
  type DevIdContextValue,
  type VcChordModifiers,
} from "../DevIdProvider";
export {
  SectionRegistryProvider,
  useSectionRegistry,
  type DevIdComponentTag,
  type RegistryEntry,
} from "../SectionRegistry";
export {
  getShortcut,
  getVisibleShortcuts,
  matchShortcut,
  type ShortcutDescriptor,
  type ShortcutKind,
} from "../devid-shortcut-registry";
