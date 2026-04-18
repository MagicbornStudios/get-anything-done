/**
 * `@vc-core` — framework-agnostic Visual Context primitives.
 *
 * Import this from any adapter (React, vanilla HTML, Kaplay, Phaser, …) to
 * share the same types and pure helpers. Do NOT import DOM / React / engine
 * modules from here — keep this layer renderer-free.
 */

export { sortRegistryEntries } from "./sort";
export type {
  VcComponentTag,
  VcLeaf,
  VcRegistryEntry,
  VcSelectionSnapshot,
} from "./types";
