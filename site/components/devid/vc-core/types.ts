/**
 * `@vc-core` — framework-agnostic Visual Context types.
 *
 * These types describe identified regions without touching React, the DOM, or
 * any specific renderer. Keeping them in a pure-TS module lets `vc-dom` (DOM
 * adapter), `vc-react` (React adapter), `vc-kaplay` / `vc-phaser` (game-engine
 * adapters) all speak the same vocabulary.
 *
 * Design constraints:
 * - No runtime imports. Type-only file so adapters can include it at zero cost.
 * - No `HTMLElement` / `React.ReactNode` / engine-specific refs.
 * - Every optional field MUST be optional — a minimal caller (a vanilla-HTML
 *   page with `data-cid` attributes) should be able to emit entries with just
 *   `{ cid, label, depth }`.
 */

/** Stable component tag. Adapters may extend the union at the schema edge. */
export type VcComponentTag = "SiteSection" | "Identified" | (string & {});

/** A single identified region. Serializable (no functions, no engine refs). */
export interface VcRegistryEntry {
  /** Clipboard-safe identifier (e.g. `evolution-site-section::title`). */
  cid: string;
  /** Human label for panels / prompts (defaults to cid). */
  label: string;
  /**
   * 0-based depth within the scope. A scope with one top-level landmark and
   * an inner `Identified` reports `[{ depth: 0 }, { depth: 1 }]`.
   */
  depth: number;
  /** Origin component (enables filtering by type). */
  componentTag?: VcComponentTag;
  /** Grep-style hint for source-link handoff (`cid="…"` / `stableCid="…"`). */
  searchHint?: string;
}

/** A leaf picked by the user (`Alt+click` / `Ctrl+click`). Adapter-produced. */
export interface VcLeaf {
  cid: string;
  label?: string;
  depth: number;
  searchHint: string;
}

/**
 * Minimal selection snapshot consumed by overlay renderers. Fields mirror the
 * React-side `SelectionState` but use plain arrays so any non-React store
 * (zustand in a Kaplay demo, a Phaser scene registry, a bare `Set`) can emit
 * the same shape.
 */
export interface VcSelectionSnapshot {
  highlightCid: string | null;
  sameDepthMergeCids: readonly string[];
  ctrlLaneCids: readonly string[];
  flashCid: string | null;
}
