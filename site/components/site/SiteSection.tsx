"use client";

import type { MouseEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BandDevPanel } from "@/components/devid/BandDevPanel";
import { DevIdBandProvider } from "@/components/devid/DevIdBandContext";
import { useDevId } from "@/components/devid/DevIdProvider";
import { cn } from "@/lib/utils";

export type SiteSectionProps = {
  children: ReactNode;
  id?: string;
  tone?: "default" | "muted";
  className?: string;
  shellClassName?: string;
  /** Preferred explicit dev-id/search token for this section band. */
  cid?: string;
  /** Rendered inside `<section>` before the `section-shell` wrapper (e.g. hero backgrounds). */
  beforeShell?: ReactNode;
  /** Rendered inside `<section>` after the `section-shell` wrapper. */
  afterShell?: ReactNode;
  /**
   * Legacy alias for `cid`. When omitted, the band id falls back to the route-based auto id.
   */
  stableBandCid?: string;
  /** Opt out of the DevId panel on this section (enabled by default when DevId mode is ON). */
  devIds?: boolean;
  /** Kept for compatibility; section scanning now uses the outer band panel path. */
  devIdDepth?: number;
};

type SurfaceProps = Omit<SiteSectionProps, "devIds" | "devIdDepth"> & {
  devIds: boolean;
};

function toPascalToken(token: string) {
  return token
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function routePrefix(pathname: string) {
  if (!pathname || pathname === "/") return "Home";
  const tokens = pathname
    .split("/")
    .filter(Boolean)
    .map((token) => toPascalToken(token))
    .filter(Boolean);
  return tokens.length > 0 ? tokens.join("") : "Route";
}

function SiteSectionSurface({
  children,
  id,
  tone = "default",
  className,
  shellClassName,
  cid,
  beforeShell,
  afterShell,
  devIds,
  stableBandCid,
}: SurfaceProps) {
  const { enabled, highlightCid, setHighlightCid, flashCid } = useDevId();
  const pathname = usePathname() ?? "/";
  const prefix = routePrefix(pathname);
  const sectionBandCid = cid ?? stableBandCid ?? id;
  const sectionBandLabel = sectionBandCid ?? `${prefix}SiteSection`;
  const searchHint = cid
    ? `cid="${cid}"`
    : stableBandCid
      ? `stableBandCid="${stableBandCid}"`
      : id
        ? `id="${id}"`
        : undefined;

  const bandCid = devIds && enabled && sectionBandCid ? sectionBandCid : undefined;
  const isHighlighted = sectionBandCid != null && highlightCid === sectionBandCid;
  const isFlash = sectionBandCid != null && flashCid === sectionBandCid;
  const showPersistentRing = devIds && enabled && isHighlighted;
  const showFlashRing = devIds && enabled && isFlash && !isHighlighted;

  const handleClick =
    devIds && enabled && sectionBandCid
      ? (e: MouseEvent) => {
          if (!e.altKey) return;
          e.stopPropagation();
          navigator.clipboard?.writeText(searchHint ?? sectionBandCid).catch(() => {});
          setHighlightCid(sectionBandCid);
        }
      : undefined;

  return (
    <div className="group/site-band relative">
      <section
        id={id}
        data-cid={bandCid}
        data-cid-label={bandCid ? sectionBandLabel : undefined}
        data-cid-component-tag={bandCid ? "SiteSection" : undefined}
        data-cid-search={bandCid ? searchHint : undefined}
        onClick={handleClick}
        className={cn(
          "relative border-b border-border/60",
          tone === "muted" && "bg-card/20",
          className,
          showPersistentRing && "outline outline-2 outline-offset-2 outline-accent",
          showFlashRing &&
            "outline outline-2 outline-offset-2 outline-emerald-400/90 shadow-[0_0_0_4px_rgba(52,211,153,0.25)] transition-[outline-color,box-shadow] duration-300",
        )}
      >
        {beforeShell}
        <div className={cn("section-shell", shellClassName)}>
          <DevIdBandProvider bandCid={sectionBandCid}>{children}</DevIdBandProvider>
        </div>
        {afterShell}
      </section>
      {devIds && enabled && sectionBandCid ? (
        <BandDevPanel
          cid={sectionBandCid}
          label={sectionBandLabel}
          edge="top"
          corner="right"
          componentTag="SiteSection"
          searchHint={searchHint}
        />
      ) : null}
    </div>
  );
}

export function SiteSection({
  children,
  id,
  tone = "default",
  className,
  shellClassName,
  cid,
  beforeShell,
  afterShell,
  stableBandCid,
  devIds = true,
  devIdDepth: _devIdDepth = 3,
}: SiteSectionProps) {
  return (
    <SiteSectionSurface
      id={id}
      tone={tone}
      className={className}
      shellClassName={shellClassName}
      cid={cid}
      beforeShell={beforeShell}
      afterShell={afterShell}
      devIds={devIds}
      stableBandCid={stableBandCid}
    >
      {children}
    </SiteSectionSurface>
  );
}

