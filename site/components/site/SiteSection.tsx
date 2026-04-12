import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SiteSectionProps = {
  children: ReactNode;
  id?: string;
  tone?: "default" | "muted";
  className?: string;
  shellClassName?: string;
};

export function SiteSection({
  children,
  id,
  tone = "default",
  className,
  shellClassName,
}: SiteSectionProps) {
  return (
    <section
      id={id}
      className={cn("border-b border-border/60", tone === "muted" && "bg-card/20", className)}
    >
      <div className={cn("section-shell", shellClassName)}>{children}</div>
    </section>
  );
}
