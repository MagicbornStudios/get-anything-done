"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EvalFilterSurfaceProps = {
  children: ReactNode;
  className?: string;
};

/** Shared card shell for eval/playable filter rows (visual CMS band). */
export function EvalFilterSurface({ children, className }: EvalFilterSurfaceProps) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card/30 p-4", className)}>
      {children}
    </div>
  );
}
