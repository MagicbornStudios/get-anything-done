"use client";

/**
 * `<Identified as="MetricCard">` — styled, selection-aware wrapper around
 * `IdentifiedPrimitive`.
 *
 * The primitive handles **identity** (registry, data-cid, click reporting).
 * This component handles **selection UI**: highlight rings, the Alt-merge
 * lane, the Ctrl reference lane, flash-on-locate, and the PNG-capture ring
 * suppression. Split intentionally so:
 *
 * - Non-React adapters (future Kaplay/Phaser, or a vanilla HTML shim) can
 *   reuse the primitive without importing any Tailwind classes.
 * - The ring computation can be memoized in one place (see `useIdentifiedRings`).
 * - The selection-state reducer (Bundle B2) has one integration site for
 *   Alt / Ctrl lane updates instead of inline closures over three setters.
 */

import { useCallback, useMemo } from "react";
import { useDevIdEnabled, useDevIdSettings } from "./DevIdProvider";
import {
  IdentifiedPrimitive,
  readDepthForCid,
  type IdentifiedLeaf,
} from "./IdentifiedPrimitive";
import {
  altPickLeaf,
  setCtrlLaneCids,
  useIsFlashing,
  useIsHighlighted,
  useIsInAltMerge,
  useIsInCtrlLane,
} from "./vc-selection";

export interface IdentifiedProps {
  as: string;
  tag?: keyof React.JSX.IntrinsicElements;
  depth?: number;
  className?: string;
  children?: React.ReactNode;
  /**
   * When false, does not appear in the section dev panel list (still gets
   * data-cid + highlight when enabled). Use for inner chrome (e.g. headings)
   * when an outer `Identified` represents the whole band.
   */
  register?: boolean;
  /** Preferred explicit dev-id/search token. */
  cid?: string;
  /** Fixed `data-cid` / clipboard id (no React useId suffix). Implies a stable landmark. */
  stableCid?: string;
}

interface IdentifiedRingState {
  inAltMerge: boolean;
  inCtrl: boolean;
  isPrimaryHighlight: boolean;
  isFlash: boolean;
  stripRingsForCapture: boolean;
  enabled: boolean;
}

/**
 * Pure rendering of ring class names from selection state. Kept as a plain
 * function (not a hook) so the wrapper can decide when to memoize the result.
 * Current call is per-render; B1 can wrap with `useMemo` keyed on the inputs.
 */
function computeIdentifiedRingClasses(state: IdentifiedRingState): string {
  const { inAltMerge, inCtrl, isPrimaryHighlight, isFlash, stripRingsForCapture, enabled } = state;
  if (!enabled || stripRingsForCapture) return "";
  const hasPersistentSelection = isPrimaryHighlight || inAltMerge || inCtrl;
  const parts: string[] = [];
  if (inCtrl) parts.push("shadow-[inset_0_0_0_2px_rgba(56,189,248,0.78)]");
  if (isPrimaryHighlight) {
    parts.push("ring-2 ring-inset ring-accent");
  } else if (inAltMerge) {
    parts.push("ring-2 ring-inset ring-violet-500/65");
  }
  if (isFlash && !hasPersistentSelection) {
    parts.push(
      "ring-2 ring-inset ring-emerald-400/90 shadow-[inset_0_0_12px_rgba(52,211,153,0.2)] transition-[box-shadow,ring-color] duration-300",
    );
  }
  return parts.join(" ");
}

export function Identified({
  as,
  tag = "div",
  depth = 1,
  className,
  children,
  register = true,
  cid,
  stableCid,
}: IdentifiedProps) {
  const resolvedCid = cid ?? stableCid ?? as;
  const searchHint = cid
    ? `cid="${cid}"`
    : stableCid
      ? `stableCid="${stableCid}"`
      : `as="${as}"`;

  /**
   * Per-cid subscriptions: `Identified` mounts in large numbers, so each instance
   * subscribes ONLY to its own selection booleans via the `vc-selection` store.
   * Result: an `Identified` re-renders only when ITS highlight/lane/flash flips —
   * not when any other section changes selection. Settings changes (verbosity,
   * hover hints, dismissed bands, media refs) also no longer cascade.
   */
  const { enabled } = useDevIdEnabled();
  const isPrimaryHighlight = useIsHighlighted(resolvedCid);
  const inAltMerge = useIsInAltMerge(resolvedCid);
  const inCtrl = useIsInCtrlLane(resolvedCid);
  const isFlash = useIsFlashing(resolvedCid);
  const { vcIdentifiedRingsSuppressedForPngCapture } = useDevIdSettings();

  /**
   * Memoize the ring className so the string build is skipped when none of
   * the selection booleans change. Mostly a readability / micro-alloc win —
   * the big perf gain is that we don't render here at all in the common case.
   */
  const ringClasses = useMemo(
    () =>
      computeIdentifiedRingClasses({
        enabled,
        inAltMerge,
        inCtrl,
        isPrimaryHighlight,
        isFlash,
        stripRingsForCapture: enabled && vcIdentifiedRingsSuppressedForPngCapture,
      }),
    [
      enabled,
      inAltMerge,
      inCtrl,
      isPrimaryHighlight,
      isFlash,
      vcIdentifiedRingsSuppressedForPngCapture,
    ],
  );

  /**
   * Highlights use **inset** rings so they are not clipped by `overflow-hidden`
   * ancestors (outlines sit outside the box and are easy to cut off at
   * modal/section edges). `scroll-mt-*` gives Locate / scroll-into-view a
   * little air at the top.
   */
  const composedClassName = useMemo(
    () =>
      [
        className,
        enabled ? "scroll-mt-3 scroll-mb-1 sm:scroll-mt-4" : "",
        ringClasses,
      ]
        .filter(Boolean)
        .join(" "),
    [className, enabled, ringClasses],
  );

  const onAltPick = useCallback((leaf: IdentifiedLeaf) => {
    navigator.clipboard?.writeText(leaf.searchHint).catch(() => {});
    // Batched: highlight + merge flip in one store mutation / one notify pass.
    altPickLeaf(leaf.cid, (prev) => {
      if (prev.length === 0) return [leaf.cid];
      const anchorDepth = readDepthForCid(prev[0]);
      if (anchorDepth != null && leaf.depth !== anchorDepth) return [leaf.cid];
      if (prev.includes(leaf.cid)) {
        const next = prev.filter((c) => c !== leaf.cid);
        return next.length > 0 ? next : [leaf.cid];
      }
      const sameDepthKeep = prev.filter((c) => readDepthForCid(c) === leaf.depth);
      return [...sameDepthKeep, leaf.cid];
    });
  }, []);

  const onCtrlToggle = useCallback((leaf: IdentifiedLeaf) => {
    setCtrlLaneCids((prev) => {
      if (prev.includes(leaf.cid)) return prev.filter((c) => c !== leaf.cid);
      return [...prev, leaf.cid];
    });
  }, []);

  return (
    <IdentifiedPrimitive
      as={as}
      resolvedCid={resolvedCid}
      searchHint={searchHint}
      tag={tag}
      depth={depth}
      className={composedClassName}
      enabled={enabled}
      register={register}
      onAltPick={onAltPick}
      onCtrlToggle={onCtrlToggle}
    >
      {children}
    </IdentifiedPrimitive>
  );
}
