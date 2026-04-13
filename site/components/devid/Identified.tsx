"use client";

/**
 * <Identified as="MetricCard"> — wraps a component and registers a
 * deterministic, copy-pasteable component ID with the nearest SectionRegistry.
 *
 * The cid is generated from React's `useId()` (SSR-stable) combined with the
 * `as` label so it looks like `metric-card-«r0»`. No hand maintenance.
 *
 * Renders as a plain `<div>` by default but accepts `tag` for semantic fit.
 * When dev-ids are enabled, applies data-cid + an optional highlight ring.
 */

import { createElement, useEffect, useId } from "react";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry } from "./SectionRegistry";

function slugify(label: string) {
  return label
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface IdentifiedProps {
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
  stableCid,
}: IdentifiedProps) {
  const rid = useId();
  const autoCid = `${slugify(as)}-${rid.replace(/[^a-z0-9]/gi, "")}`;
  const cid = stableCid ?? autoCid;
  const { enabled, highlightCid, setHighlightCid, flashCid } = useDevId();
  const registry = useSectionRegistry();
  const registerFn = registry?.register;
  const maxDepth = registry?.maxDepth;

  useEffect(() => {
    if (!register) return;
    if (!registerFn || maxDepth === undefined) return;
    if (depth > maxDepth) return;
    return registerFn({ cid, label: as, depth });
  }, [register, registerFn, maxDepth, cid, as, depth]);

  const isHighlighted = highlightCid === cid;
  const isFlash = flashCid === cid;
  const showPersistentRing = enabled && isHighlighted;
  const showFlashRing = enabled && isFlash && !isHighlighted;

  const handleClick = enabled
    ? (e: React.MouseEvent) => {
        if (!e.altKey) return;
        e.stopPropagation();
        navigator.clipboard?.writeText(cid).catch(() => {});
        setHighlightCid(cid);
      }
    : undefined;

  return createElement(
    tag,
    {
      "data-cid": enabled ? cid : undefined,
      "data-cid-label": enabled ? as : undefined,
      onClick: handleClick,
      className: [
        className,
        showPersistentRing
          ? "outline outline-2 outline-offset-2 outline-accent"
          : "",
        showFlashRing
          ? "outline outline-2 outline-offset-2 outline-emerald-400 transition-[outline-color] duration-200"
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    children,
  );
}
