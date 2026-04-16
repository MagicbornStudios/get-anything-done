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
import { queryByCid } from "./devid-dom-scan";

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

function readDepthForCid(cid: string): number | null {
  const el = typeof document === "undefined" ? null : queryByCid(cid);
  if (!el) return null;
  const raw = el.getAttribute("data-cid-depth");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pickLeafFromEvent(event: React.MouseEvent): { cid: string; searchHint: string; depth: number } | null {
  const path =
    typeof event.nativeEvent.composedPath === "function" ? event.nativeEvent.composedPath() : [];
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue;
    const nodeCid = node.getAttribute("data-cid");
    if (!nodeCid) continue;
    const dh = node.getAttribute("data-cid-depth");
    const depth =
      dh != null && dh !== "" && Number.isFinite(Number(dh)) ? Number(dh) : 0;
    const searchHint = node.getAttribute("data-cid-search") ?? nodeCid;
    return { cid: nodeCid, searchHint, depth };
  }
  return null;
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
  const {
    enabled,
    highlightCid,
    setHighlightCid,
    sameDepthMergeCids,
    setSameDepthMergeCids,
    ctrlLaneCids,
    setCtrlLaneCids,
    flashCid,
  } = useDevId();
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

  const inAltMerge = sameDepthMergeCids.includes(resolvedCid);
  const inCtrl = ctrlLaneCids.includes(resolvedCid);
  const isPrimaryHighlight = highlightCid === resolvedCid;
  const isFlash = flashCid === resolvedCid;
  const hasPersistentSelection = isPrimaryHighlight || inAltMerge || inCtrl;
  const showFlashRing = enabled && isFlash && !hasPersistentSelection;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      const leaf = pickLeafFromEvent(e);
      if (!leaf) return;

      if (e.altKey) {
        e.stopPropagation();
        navigator.clipboard?.writeText(leaf.searchHint).catch(() => {});
        setHighlightCid(leaf.cid);
        setSameDepthMergeCids((prev) => {
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
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        e.stopPropagation();
        setCtrlLaneCids((prev) => {
          if (prev.includes(leaf.cid)) return prev.filter((c) => c !== leaf.cid);
          return [...prev, leaf.cid];
        });
      }
    },
    [enabled, setHighlightCid, setSameDepthMergeCids, setCtrlLaneCids],
  );

  const ctrlHalo =
    enabled && inCtrl ? "shadow-[inset_0_0_0_2px_rgba(56,189,248,0.78)]" : "";
  let altRing = "";
  if (enabled && (isPrimaryHighlight || inAltMerge)) {
    altRing = isPrimaryHighlight
      ? "ring-2 ring-inset ring-accent"
      : "ring-2 ring-inset ring-violet-500/65";
  }

  /**
   * Highlights use **inset** rings so they are not clipped by `overflow-hidden` ancestors
   * (outlines sit outside the box and are easy to cut off at modal/section edges).
   * `scroll-mt-*` gives Locate / scroll-into-view a little air at the top.
   */
  return createElement(
    tag,
    {
      "data-cid": enabled ? resolvedCid : undefined,
      "data-cid-depth": enabled ? String(depth) : undefined,
      "data-cid-label": enabled ? as : undefined,
      "data-cid-component-tag": enabled ? "Identified" : undefined,
      "data-cid-search": enabled ? searchHint : undefined,
      onClick: enabled ? handleClick : undefined,
      className: [
        className,
        enabled ? "scroll-mt-3 scroll-mb-1 sm:scroll-mt-4" : "",
        ctrlHalo,
        altRing,
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
