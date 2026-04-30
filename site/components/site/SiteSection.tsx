"use client";

import type { MouseEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BandDevPanel } from "gad-visual-context";
import { BandDevPanelGate } from "gad-visual-context";
import { DevIdBandProvider } from "gad-visual-context";
import { useDevId } from "gad-visual-context";
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
   * When false, omit the shared `section-shell` class so `shellClassName` fully controls layout.
   * Use for full-bleed page wrappers: `section-shell` is a single bundled utility and
   * tailwind-merge cannot strip its max-width when you only add `max-w-none` alongside it.
   */
  sectionShell?: boolean;
  /**
   * Legacy alias for `cid`. When omitted, the band id falls back to the route-based auto id.
   */
  stableBandCid?: string;
  /** Opt out of dev-id attributes, highlights, Alt+click, and band panel on this section (on by default when DevId mode is ON). */
  devIds?: boolean;
  /** Kept for compatibility; section scanning now uses the outer band panel path. */
  devIdDepth?: number;
  /**
   * When false, do not mount the band Visual Context Panel (`BandDevPanel`) on this section.
   * `data-cid`, highlight rings, and Alt+click copy still apply when `devIds` is true.
   * Use for dense UI (charts, drag surfaces) where the hover overlay gets in the way.
   * @default true
   */
  allowContextPanel?: boolean;
};

type SurfaceProps = Omit<SiteSectionProps, "devIds" | "devIdDepth"> & {
  devIds: boolean;
  allowContextPanel: boolean;
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
  sectionShell = true,
  devIds,
  stableBandCid,
  allowContextPanel,
}: SurfaceProps) {
  const { enabled, highlightCid, setHighlightCid, flashCid, dismissedBandCids, toggleBandDismiss } = useDevId();
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

  const bandPanelActive =
    devIds && enabled && !!sectionBandCid && allowContextPanel && !dismissedBandCids.has(sectionBandCid);

  return (
    <BandDevPanelGate
      active={bandPanelActive}
      renderPanel={() =>
        sectionBandCid ? (
          <BandDevPanel
            cid={sectionBandCid}
            label={sectionBandLabel}
            edge="top"
            corner="right"
            componentTag="SiteSection"
            searchHint={searchHint}
            onDismiss={() => toggleBandDismiss(sectionBandCid)}
          />
        ) : null
      }
    >
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
        <div className={cn(sectionShell && "section-shell", shellClassName)}>
          <DevIdBandProvider bandCid={sectionBandCid}>{children}</DevIdBandProvider>
        </div>
        {afterShell}
      </section>
    </BandDevPanelGate>
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
  sectionShell = true,
  stableBandCid,
  devIds = true,
  devIdDepth: _devIdDepth = 3,
  allowContextPanel = true,
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
      sectionShell={sectionShell}
      devIds={devIds}
      stableBandCid={stableBandCid}
      allowContextPanel={allowContextPanel}
    >
      {children}
    </SiteSectionSurface>
  );
}
