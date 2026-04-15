"use client";

/**
 * <Identified as="MetricCard"> — wraps a component and registers a
 * deterministic, copy-pasteable component ID with the nearest SectionRegistry.
 *
 * Default behavior is intentionally literal: `data-cid` falls back to the
 * `as` string itself so the copied token is directly greppable in source.
 *
 * Renders as a plain `<div>` by default but accepts `tag` for semantic fit.
 * When dev-ids are enabled, applies data-cid + an optional highlight ring.
 */

import { createElement, useCallback, useEffect } from "react";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry } from "./SectionRegistry";

export interface IdentifiedProps {
  as: string;
  tag?: keyof React.JSX.IntrinsicElements;
  depth?: number;
  className?: string;
  children?: React.ReactNode;
  /**
   * When false, does not appear in the section dev panel list (still gets data-cid + highlight when enabled).
   * Use for inner chrome (e.g. headings) when an outer `Identified` represents the whole band.
   */
  register?: boolean;
  /** Preferred explicit dev-id/search token. */
  cid?: string;
  /** Fixed `data-cid` / clipboard id (no React useId suffix). Implies a stable landmark, e.g. the dev panel shell. */
  stableCid?: string;
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
  const { enabled, highlightCid, setHighlightCid, flashCid } = useDevId();
  const registry = useSectionRegistry();
  const registerFn = registry?.register;
  const maxDepth = registry?.maxDepth;

  useEffect(() => {
    if (!register) return;
    if (!registerFn || maxDepth === undefined) return;
    if (depth > maxDepth) return;
    return registerFn({
      cid: resolvedCid,
      label: as,
      depth,
      componentTag: "Identified",
      searchHint,
    });
  }, [register, registerFn, maxDepth, resolvedCid, as, depth, searchHint]);

  const isHighlighted = highlightCid === resolvedCid;
  const isFlash = flashCid === resolvedCid;
  const showPersistentRing = enabled && isHighlighted;
  const showFlashRing = enabled && isFlash && !isHighlighted;

  function cycleTargetFromEvent(
    event: React.MouseEvent,
    currentHighlight: string | null,
  ): { cid: string; searchHint: string } {
    const path = typeof event.nativeEvent.composedPath === "function"
      ? event.nativeEvent.composedPath()
      : [];
    const seen = new Set<string>();
    const candidates: Array<{ cid: string; searchHint: string }> = [];
    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      const nodeCid = node.getAttribute("data-cid");
      if (!nodeCid || seen.has(nodeCid)) continue;
      seen.add(nodeCid);
      candidates.push({
        cid: nodeCid,
        searchHint: node.getAttribute("data-cid-search") ?? nodeCid,
      });
    }

    if (candidates.length === 0) {
      return { cid: resolvedCid, searchHint: searchHint ?? resolvedCid };
    }

    if (!currentHighlight) return candidates[0];
    const currentIndex = candidates.findIndex((candidate) => candidate.cid === currentHighlight);
    if (currentIndex < 0) return candidates[0];
    return candidates[(currentIndex + 1) % candidates.length];
  }

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      if (!e.altKey) return;
      e.stopPropagation();
      const next = cycleTargetFromEvent(e, highlightCid);
      navigator.clipboard?.writeText(next.searchHint).catch(() => {});
      setHighlightCid(next.cid);
    },
    [enabled, highlightCid, setHighlightCid],
  );

  /**
   * Highlights use **inset** rings so they are not clipped by `overflow-hidden` ancestors
   * (outlines sit outside the box and are easy to cut off at modal/section edges).
   * `scroll-mt-*` gives Locate / scroll-into-view a little air at the top.
   */
  return createElement(
    tag,
    {
      "data-cid": enabled ? resolvedCid : undefined,
      "data-cid-label": enabled ? as : undefined,
      "data-cid-component-tag": enabled ? "Identified" : undefined,
      "data-cid-search": enabled ? searchHint : undefined,
      onClick: enabled ? handleClick : undefined,
      className: [
        className,
        enabled ? "scroll-mt-3 scroll-mb-1 sm:scroll-mt-4" : "",
        showPersistentRing ? "ring-2 ring-inset ring-accent" : "",
        showFlashRing
          ? "ring-2 ring-inset ring-emerald-400/90 shadow-[inset_0_0_12px_rgba(52,211,153,0.2)] transition-[box-shadow,ring-color] duration-300"
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    children,
  );
}
