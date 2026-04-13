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
}

export function Identified({
  as,
  tag = "div",
  depth = 1,
  className,
  children,
}: IdentifiedProps) {
  const rid = useId();
  const cid = `${slugify(as)}-${rid.replace(/[^a-z0-9]/gi, "")}`;
  const { enabled, highlightCid, setHighlightCid } = useDevId();
  const registry = useSectionRegistry();
  const register = registry?.register;
  const maxDepth = registry?.maxDepth;

  useEffect(() => {
    if (!register || maxDepth === undefined) return;
    if (depth > maxDepth) return;
    return register({ cid, label: as, depth });
  }, [register, maxDepth, cid, as, depth]);

  const isHighlighted = highlightCid === cid;

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
        enabled && isHighlighted
          ? "outline outline-2 outline-offset-2 outline-accent"
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    children,
  );
}
