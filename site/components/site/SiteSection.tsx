import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionRegistryProvider } from "@/components/devid/SectionRegistry";
import { SectionDevPanel } from "@/components/devid/SectionDevPanel";

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
  /** Opt out of the DevId panel on this section (enabled by default when DevId mode is ON). */
  devIds?: boolean;
  /** Max <Identified> depth to register in this section. Default 3. */
  devIdDepth?: number;
};

export function SiteSection({
  children,
  id,
  tone = "default",
  className,
  shellClassName,
  beforeShell,
  afterShell,
  devIds = true,
  devIdDepth = 3,
}: SiteSectionProps) {
  const inner = (
    <section
      id={id}
      className={cn(
        "relative border-b border-border/60",
        tone === "muted" && "bg-card/20",
        className,
      )}
    >
      {beforeShell}
      <div className={cn("section-shell", shellClassName)}>{children}</div>
      {afterShell}
      {devIds && <SectionDevPanel />}
    </section>
  );

  return devIds ? (
    <SectionRegistryProvider maxDepth={devIdDepth}>{inner}</SectionRegistryProvider>
  ) : (
    inner
  );
}
