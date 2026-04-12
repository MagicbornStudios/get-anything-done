import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TITLE_PRESETS = {
  hero: "max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl",
  "hero-compact": "max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl",
  section: "max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl",
} as const;

export type SiteSectionHeadingPreset = keyof typeof TITLE_PRESETS;

export type SiteSectionHeadingProps = {
  icon?: LucideIcon;
  /** Omit when the title row stands alone (e.g. kicker lives in a custom toolbar row). */
  kicker?: string;
  /** Omit when the section has only a kicker row (no heading line). */
  title?: ReactNode;
  as?: "h1" | "h2" | "h3";
  preset?: SiteSectionHeadingPreset;
  titleClassName?: string;
  /** Merges with the icon+kicker row (icon present only). */
  kickerRowClassName?: string;
  /** Lucide icon color (default: accent). */
  iconClassName?: string;
  className?: string;
};

export function SiteSectionHeading({
  icon: Icon,
  kicker,
  title,
  as: Tag = "h2",
  preset = "section",
  titleClassName,
  kickerRowClassName,
  iconClassName,
  className,
}: SiteSectionHeadingProps) {
  const titleCls = titleClassName ?? TITLE_PRESETS[preset];

   const kickerBlock =
    Icon != null ? (
      <div className={cn("mb-2 flex items-center gap-2", kickerRowClassName)}>
        <Icon size={18} className={cn("text-accent", iconClassName)} aria-hidden />
        {kicker != null && kicker !== "" ? (
          <p className="section-kicker !mb-0">{kicker}</p>
        ) : null}
      </div>
    ) : kicker != null && kicker !== "" ? (
      <p className="section-kicker">{kicker}</p>
    ) : null;

  return (
    <div className={className}>
      {kickerBlock}
      {title != null ? <Tag className={titleCls}>{title}</Tag> : null}
    </div>
  );
}
