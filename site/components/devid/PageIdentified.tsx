"use client";

/**
 * Page-level dev landmark. Uses the same band-level dev panel path as nav/footer so
 * page bands get stable copy/search tokens plus update/delete handoff flow.
 */

import { createElement, type ReactNode } from "react";
import { BandDevPanel } from "./BandDevPanel";
import { useDevId } from "./DevIdProvider";
import { cn } from "@/lib/utils";

export interface PageIdentifiedProps {
  as: string;
  tag?: keyof React.JSX.IntrinsicElements;
  /** Preferred explicit dev-id/search token. */
  cid?: string;
  /** Fixed clipboard / `data-cid` (no React `useId` suffix). */
  stableCid?: string;
  className?: string;
  children?: ReactNode;
  /** Where the band dev panel sits over the band (default top-left). */
  chipCorner?: "bottom-left" | "top-left";
}

export function PageIdentified({
  as,
  tag = "div",
  cid,
  stableCid,
  className,
  children,
  chipCorner = "top-left",
}: PageIdentifiedProps) {
  const resolvedCid = cid ?? stableCid ?? as;
  const searchHint = cid
    ? `cid="${cid}"`
    : stableCid
      ? `stableCid="${stableCid}"`
      : `as="${as}"`;
  const { enabled, highlightCid, setHighlightCid, flashCid } = useDevId();
  const isHighlighted = enabled && highlightCid === resolvedCid;
  const isFlash = enabled && flashCid === resolvedCid;
  const edge = chipCorner === "top-left" ? "top" : "bottom";

  return createElement(
    tag,
    {
      "data-cid": enabled ? resolvedCid : undefined,
      "data-cid-label": enabled ? as : undefined,
      "data-cid-component-tag": enabled ? "PageIdentified" : undefined,
      "data-cid-search": enabled ? searchHint : undefined,
      onClick: enabled
        ? (e: React.MouseEvent) => {
            if (!e.altKey) return;
            e.stopPropagation();
            navigator.clipboard?.writeText(searchHint ?? resolvedCid).catch(() => {});
            setHighlightCid(resolvedCid);
          }
        : undefined,
      className: cn(
        "group/site-band relative",
        className,
        isHighlighted && "outline outline-2 outline-offset-2 outline-accent",
        enabled &&
          isFlash &&
          !isHighlighted &&
          "outline outline-2 outline-offset-2 outline-emerald-400/90 shadow-[0_0_0_4px_rgba(52,211,153,0.25)] transition-[outline-color,box-shadow] duration-300",
      ),
    },
    <>
      {children}
      {enabled ? (
        <BandDevPanel
          cid={resolvedCid}
          label={as}
          edge={edge}
          corner="left"
          componentTag="PageIdentified"
          searchHint={searchHint}
        />
      ) : null}
    </>,
  );
}
