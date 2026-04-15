"use client";

import type { ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/**
 * Radix HoverCard for dev / visual-context chrome — replaces native `title` tooltips
 * so copy stays readable and z-order stays above panels (`z-[80]`) and modals (`z-[210]`).
 */
export function DevChromeHoverHint({
  children,
  body,
  side = "top",
  align = "center",
  openDelay = 95,
  closeDelay = 70,
  contentClassName,
}: {
  children: ReactNode;
  body: ReactNode;
  side?: Side;
  align?: Align;
  openDelay?: number;
  closeDelay?: number;
  contentClassName?: string;
}) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={6}
        className={cn(
          "z-[230] w-max max-w-[min(20rem,90vw)] border-border/70 p-2.5 text-[10px] leading-snug text-popover-foreground shadow-md",
          contentClassName,
        )}
      >
        {body}
      </HoverCardContent>
    </HoverCard>
  );
}
