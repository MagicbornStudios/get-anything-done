"use client";

import type { ReactNode, RefObject } from "react";
import type { Measurable } from "@radix-ui/rect";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import * as PopperPrimitive from "@radix-ui/react-popper";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { useVcPanelHoverAnchorRef } from "./VcPanelHoverAnchorContext";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/** Horizontal dock of the Visual Context Panel (`ml-auto` = right, `ml-2` = left). */
export type VcPanelCorner = "left" | "right";

const dockedContentClass =
  "z-[230] w-max max-w-[min(20rem,90vw)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-hover-card-content-transform-origin]";

/**
 * Radix HoverCard for dev / visual-context chrome.
 * With `dockCorner` and a panel anchor from `VcPanelHoverAnchorContext`, the card is positioned
 * from the **Visual Context Panel** edge (inward), not from the small trigger — stable gutter.
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
  const panelAnchorRef = useVcPanelHoverAnchorRef();
  const side: Side =
    sideOverride ??
    (dockCorner === "right" ? "left" : dockCorner === "left" ? "right" : "top");
  const align: Align = alignOverride ?? (dockCorner ? "start" : "center");
  const sideOffset = dockCorner ? 4 : 6;
  const avoidCollisions = !dockCorner;
  const usePanelAnchor = Boolean(dockCorner && panelAnchorRef);

  if (usePanelAnchor && panelAnchorRef) {
    return (
      <HoverCardPrimitive.Root openDelay={openDelay} closeDelay={closeDelay}>
        <HoverCardPrimitive.Trigger asChild>{children}</HoverCardPrimitive.Trigger>
        <PopperPrimitive.Anchor virtualRef={panelAnchorRef as RefObject<Measurable>} />
        <HoverCardPrimitive.Portal>
          <HoverCardPrimitive.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            avoidCollisions={avoidCollisions}
            className={cn(
              dockedContentClass,
              "border-border/70 p-2.5 text-[10px] leading-snug",
              dockCorner && "max-w-[13rem]",
              contentClassName,
            )}
          >
            {body}
          </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
      </HoverCardPrimitive.Root>
    );
  }

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
