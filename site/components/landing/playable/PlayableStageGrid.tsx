import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PlayableStageGridProps = {
  children: ReactNode;
  className?: string;
};

/** Two-column layout: embed (main) + side panel — reused on home playable and project market. */
export function PlayableStageGrid({ children, className }: PlayableStageGridProps) {
  return (
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
