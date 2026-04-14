"use client";

/**
 * Page-level dev landmark — **does not** use `SectionRegistry` or the section dev panel.
 * When dev IDs are on (`Alt+I`), hovering the band shows a small **bottom-left** chip
 * with the `data-cid` and a **Copy** control. Alt+click still copies + highlights like
 * `<Identified>`.
 */

import { createElement, useCallback, useId, useState, type MouseEvent, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useDevId } from "./DevIdProvider";
import { cn } from "@/lib/utils";

function slugify(label: string) {
  return label
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface PageIdentifiedProps {
  as: string;
  tag?: keyof React.JSX.IntrinsicElements;
  /** Fixed clipboard / `data-cid` (no React `useId` suffix). */
  stableCid?: string;
  className?: string;
  children?: ReactNode;
  /** Where the dev chip sits over the band (default bottom-left). */
  chipCorner?: "bottom-left" | "top-left";
}

export function PageIdentified({
  as,
  tag = "div",
  stableCid,
  className,
  children,
  chipCorner = "bottom-left",
}: PageIdentifiedProps) {
  const rid = useId();
  const autoCid = `${slugify(as)}-${rid.replace(/[^a-z0-9]/gi, "")}`;
  const cid = stableCid ?? autoCid;
  const { enabled, highlightCid, setHighlightCid } = useDevId();
  const [copied, setCopied] = useState(false);

  const isHighlighted = highlightCid === cid;
  const showRing = enabled && isHighlighted;

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(cid).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 900);
  }, [cid]);

  const handleClick =
    enabled && cid
      ? (e: MouseEvent) => {
          if (!e.altKey) return;
          e.stopPropagation();
          navigator.clipboard?.writeText(cid).catch(() => {});
          setHighlightCid(cid);
        }
      : undefined;

  const chipPosition =
    chipCorner === "top-left"
      ? "left-2 top-2 items-start"
      : "bottom-2 left-2 items-end";

  return createElement(
    tag,
    {
      "data-cid": enabled ? cid : undefined,
      "data-cid-label": enabled ? as : undefined,
      "data-page-identified": enabled ? "1" : undefined,
      onClick: handleClick,
      className: cn(
        "group/page-identified relative",
        className,
        showRing && "outline outline-2 outline-offset-2 outline-accent",
      ),
    },
    <>
      {children}
      {enabled ? (
        <div
          className={cn(
            "pointer-events-none absolute z-[60] flex max-w-[min(100%,18rem)] flex-col gap-0.5 opacity-0 transition-opacity duration-150",
            "group-hover/page-identified:pointer-events-auto group-hover/page-identified:opacity-100",
            "group-focus-within/page-identified:pointer-events-auto group-focus-within/page-identified:opacity-100",
            chipPosition,
          )}
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-accent/40 bg-background/95 px-2 py-1 text-[10px] shadow-lg backdrop-blur">
            <span className="min-w-0 flex-1 truncate font-mono text-accent" title={cid}>
              {cid}
            </span>
            <button
              type="button"
              aria-label="Copy page band id"
              onClick={(e) => {
                e.stopPropagation();
                copy();
              }}
              className="shrink-0 rounded border border-border/60 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-muted-foreground hover:border-accent/50 hover:text-accent"
            >
              {copied ? <Check className="size-3 text-emerald-400" strokeWidth={2} /> : <Copy className="size-3" strokeWidth={2} />}
            </button>
          </div>
          <span className="pointer-events-none text-[9px] text-muted-foreground/90">Page band · Alt+click copies</span>
        </div>
      ) : null}
    </>,
  );
}
