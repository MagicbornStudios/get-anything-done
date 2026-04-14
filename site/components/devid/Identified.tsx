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
        showPersistentRing
          ? "outline outline-2 outline-offset-2 outline-accent"
          : "",
        showFlashRing
          ? "outline outline-2 outline-offset-2 outline-emerald-400/90 shadow-[0_0_0_4px_rgba(52,211,153,0.25)] transition-[outline-color,box-shadow] duration-300"
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    children,
  );
}
