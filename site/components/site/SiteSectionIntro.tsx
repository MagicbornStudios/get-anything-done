import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SiteProse, type SiteProseProps } from "./SiteProse";
import {
  SiteSectionHeading,
  type SiteSectionHeadingPreset,
} from "./SiteSectionHeading";

export type SiteSectionIntroProps = {
  icon?: LucideIcon;
  kicker?: string;
  title?: ReactNode;
  as?: "h1" | "h2" | "h3";
  preset?: SiteSectionHeadingPreset;
  titleClassName?: string;
  kickerRowClassName?: string;
  iconClassName?: string;
  headingClassName?: string;
  children: ReactNode;
  proseSize?: SiteProseProps["size"];
  proseClassName?: string;
  className?: string;
};

export function SiteSectionIntro({
  children,
  proseSize = "lg",
  proseClassName,
  className,
  headingClassName,
  ...headingProps
}: SiteSectionIntroProps) {
  const block = (
    <>
      <SiteSectionHeading className={headingClassName} {...headingProps} />
      <SiteProse size={proseSize} className={cn("mt-5", proseClassName)}>
        {children}
      </SiteProse>
    </>
  );
  return className ? <div className={className}>{block}</div> : block;
}
