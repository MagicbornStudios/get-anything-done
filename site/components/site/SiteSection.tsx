"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SectionRegistryProvider, useSectionRegistry } from "@/components/devid/SectionRegistry";
import { SectionDevPanel } from "@/components/devid/SectionDevPanel";
import { useDevId } from "@/components/devid/DevIdProvider";

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

function toKebab(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SiteSectionSurface({
  children,
  id,
  tone = "default",
  className,
  shellClassName,
  beforeShell,
  afterShell,
  devIds,
}: SurfaceProps) {
  const { enabled, highlightCid, setHighlightCid, flashCid } = useDevId();
  const pathname = usePathname() ?? "/";
  const prefix = routePrefix(pathname);
  const rid = useId();
  const sectionBandCid = `${toKebab(prefix)}-site-section-${rid.replace(/[^a-z0-9]/gi, "")}`;
  const sectionBandLabel = `${prefix}SiteSection`;
  const registry = useSectionRegistry();
  /** Stable — do not depend on `registry` itself; context value is a new object whenever `entries` changes. */
  const registerFn = registry?.register;

  useEffect(() => {
    if (!devIds || !sectionBandCid || !registerFn) return;
    const label = sectionBandLabel ?? sectionBandCid;
    return registerFn({ cid: sectionBandCid, label, depth: 0 });
  }, [devIds, sectionBandCid, sectionBandLabel, registerFn]);

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
          navigator.clipboard?.writeText(sectionBandCid).catch(() => {});
          setHighlightCid(sectionBandCid);
        }
      : undefined;

  return (
    <section
      id={id}
      data-cid={bandCid}
      data-cid-label={bandCid ? (sectionBandLabel ?? sectionBandCid) : undefined}
      onClick={handleClick}
      className={cn(
        "group/site-section relative border-b border-border/60",
        tone === "muted" && "bg-card/20",
        className,
        showPersistentRing && "outline outline-2 outline-offset-2 outline-accent",
        showFlashRing &&
          "outline outline-2 outline-offset-2 outline-emerald-400/90 shadow-[0_0_0_4px_rgba(52,211,153,0.25)] transition-[outline-color,box-shadow] duration-300",
      )}
    >
      {beforeShell}
      <div className={cn("section-shell", shellClassName)}>{children}</div>
      {afterShell}
      {devIds && <SectionDevPanel />}
    </section>
  );
}

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
  const surface = (
    <SiteSectionSurface
      id={id}
      tone={tone}
      className={className}
      shellClassName={shellClassName}
      beforeShell={beforeShell}
      afterShell={afterShell}
      devIds={devIds}
    >
      {children}
    </SiteSectionSurface>
  );

  return devIds ? (
    <SectionRegistryProvider maxDepth={devIdDepth}>{surface}</SectionRegistryProvider>
  ) : (
    surface
  );
}
