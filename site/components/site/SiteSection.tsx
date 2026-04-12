import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SiteSectionProps = {
  children: ReactNode;
  id?: string;
  tone?: "default" | "muted";
  className?: string;
  shellClassName?: string;
  /** Rendered inside `<section>` before the `section-shell` wrapper (e.g. hero backgrounds). */
  beforeShell?: ReactNode;
  /** Rendered inside `<section>` after the `section-shell` wrapper. */
  afterShell?: ReactNode;
};

export function SiteSection({
  children,
  id,
  tone = "default",
  className,
  shellClassName,
  beforeShell,
  afterShell,
}: SiteSectionProps) {
  return (
    <section
      id={id}
      className={cn("border-b border-border/60", tone === "muted" && "bg-card/20", className)}
    >
      {beforeShell}
      <div className={cn("section-shell", shellClassName)}>{children}</div>
      {afterShell}
    </section>
  );
}
