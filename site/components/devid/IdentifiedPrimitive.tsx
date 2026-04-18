"use client";

/**
 * Headless identity primitive.
 *
 * Responsibility: **identify**, not **decorate**.
 *
 * - Registers the node with the nearest `SectionRegistry` (depth-gated).
 * - Emits `data-cid*` attributes for the DOM scanner / Visual Context panel.
 * - Reports Alt-click and Ctrl/Cmd-click leaf picks via callbacks so the
 *   styled layer can drive selection state.
 *
 * It does **not** read selection state, highlight rings, or chord state.
 * That lives in `Identified` (the styled wrapper). This split makes the
 * primitive portable: any styling system (shadcn, Material, a raw `<div>` in
 * a non-React HTML app that's been shimmed through a compatibility layer) can
 * compose on top without pulling in the selection UI.
 *
 * Payoff for **performance**: the primitive only re-renders when its own
 * props change (data-cid attrs depend on `enabled`, `resolvedCid`, `depth`,
 * `as`, `searchHint`). The ring classes live one component up, where
 * memoization is cheap and targeted.
 *
 * Payoff for **portability**: when `vc-core` lands (Bundle C), the registry +
 * data-cid emission are the portable pieces. The styled highlight rings are
 * a React/shadcn concern. Splitting now prevents us from baking ring CSS
 * into a future vanilla adapter.
 */

import { createElement, useCallback, useEffect } from "react";
import { useSectionRegistry } from "./SectionRegistry";
import { queryByCid } from "./devid-dom-scan";

export interface IdentifiedLeaf {
  cid: string;
  searchHint: string;
  depth: number;
}

export interface IdentifiedPrimitiveProps {
  /** Human label shown in the Visual Context panel. */
  as: string;
  /** Resolved id (usually `cid ?? stableCid ?? as`). Caller is responsible for resolving. */
  resolvedCid: string;
  /** Greppable search hint written to `data-cid-search` and clipboard on Alt-click. */
  searchHint: string;
  tag?: keyof React.JSX.IntrinsicElements;
  depth?: number;
  /** Composed className — styled wrapper merges ring classes, base classes, etc. */
  className?: string;
  children?: React.ReactNode;
  /** Whether DevId mode is on. Attributes and click handling short-circuit when false. */
  enabled: boolean;
  /** When false, skip `SectionRegistry` registration (still emits data-cid / clickable). */
  register?: boolean;
  /** Alt-click leaf pick. Fires after `stopPropagation`. */
  onAltPick?: (leaf: IdentifiedLeaf) => void;
  /** Ctrl/Cmd-click (no Alt) leaf toggle. Fires after `stopPropagation`. */
  onCtrlToggle?: (leaf: IdentifiedLeaf) => void;
}

export function pickLeafFromEvent(event: React.MouseEvent): IdentifiedLeaf | null {
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

/** Reads `data-cid-depth` off a live DOM node by cid, used by selection reducers. */
export function readDepthForCid(cid: string): number | null {
  const el = typeof document === "undefined" ? null : queryByCid(cid);
  if (!el) return null;
  const raw = el.getAttribute("data-cid-depth");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function IdentifiedPrimitive({
  as,
  resolvedCid,
  searchHint,
  tag = "div",
  depth = 1,
  className,
  children,
  enabled,
  register = true,
  onAltPick,
  onCtrlToggle,
}: IdentifiedPrimitiveProps) {
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

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      const leaf = pickLeafFromEvent(e);
      if (!leaf) return;
      if (e.altKey) {
        e.stopPropagation();
        onAltPick?.(leaf);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        e.stopPropagation();
        onCtrlToggle?.(leaf);
      }
    },
    [enabled, onAltPick, onCtrlToggle],
  );

  return createElement(
    tag,
    {
      "data-cid": enabled ? resolvedCid : undefined,
      "data-cid-depth": enabled ? String(depth) : undefined,
      "data-cid-label": enabled ? as : undefined,
      "data-cid-component-tag": enabled ? "Identified" : undefined,
      "data-cid-search": enabled ? searchHint : undefined,
      onClick: enabled ? handleClick : undefined,
      className,
    },
    children,
  );
}
