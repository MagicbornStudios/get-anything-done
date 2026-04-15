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

import { createElement, useEffect } from "react";
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

  const handleClick = enabled
    ? (e: React.MouseEvent) => {
        if (!e.altKey) return;
        e.stopPropagation();
        navigator.clipboard?.writeText(searchHint ?? resolvedCid).catch(() => {});
        setHighlightCid(resolvedCid);
      }
    : undefined;

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
      onClick: handleClick,
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
