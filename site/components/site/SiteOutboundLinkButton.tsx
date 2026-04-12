import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SiteOutboundLinkButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function SiteOutboundLinkButton({ href, children, className }: SiteOutboundLinkButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "gap-2 rounded-full border-border/70 bg-background/50 px-4 py-2 text-xs font-semibold hover:border-accent hover:text-accent [&_svg]:size-3",
        className
      )}
      asChild
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink size={12} aria-hidden />
      </a>
    </Button>
  );
}
