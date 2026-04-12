import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  lg: "max-w-3xl text-lg leading-8 text-muted-foreground",
  md: "max-w-3xl text-base leading-7 text-muted-foreground",
  sm: "max-w-3xl text-sm leading-6 text-muted-foreground",
} as const;

export type SiteProseProps = {
  children: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  as?: "p" | "div";
};

export function SiteProse({ children, size = "lg", className, as: Tag = "p" }: SiteProseProps) {
  return <Tag className={cn(SIZE_CLASS[size], className)}>{children}</Tag>;
}
