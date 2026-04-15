"use client";

import type { ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/** Horizontal dock of the Visual Context Panel (`ml-auto` = right, `ml-2` = left). */
export type VcPanelCorner = "left" | "right";

/**
 * Radix HoverCard for dev / visual-context chrome.
 * With `dockCorner`, the info card opens on the **inward** side (toward page center) with a
 * fixed popper side and no flip — stays tight beside the `w-72` panel instead of floating away.
 */
export function DevChromeHoverHint({
  children,
  body,
  dockCorner,
  side: sideOverride,
  align: alignOverride,
  openDelay = 95,
  closeDelay = 70,
  contentClassName,
}: {
  children: ReactNode;
  body: ReactNode;
  dockCorner?: VcPanelCorner;
  side?: Side;
  align?: Align;
  openDelay?: number;
  closeDelay?: number;
  contentClassName?: string;
}) {
  const side: Side =
    sideOverride ??
    (dockCorner === "right" ? "left" : dockCorner === "left" ? "right" : "top");
  const align: Align = alignOverride ?? (dockCorner ? "start" : "center");
  const sideOffset = dockCorner ? 4 : 6;
  const avoidCollisions = !dockCorner;

  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        avoidCollisions={avoidCollisions}
        className={cn(
          "z-[230] w-max max-w-[min(20rem,90vw)] border-border/70 p-2.5 text-[10px] leading-snug text-popover-foreground shadow-md",
          dockCorner && "max-w-[13rem]",
          contentClassName,
        )}
      >
        {body}
      </HoverCardContent>
    </HoverCard>
  );
}
