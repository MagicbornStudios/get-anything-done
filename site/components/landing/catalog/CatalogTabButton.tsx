"use client";

import { TAB_META, type CatalogTab } from "@/components/landing/catalog/catalog-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  tabKey: CatalogTab;
  active: boolean;
  onSelect: () => void;
};

export function CatalogTabButton({ tabKey, active, onSelect }: Props) {
  const meta = TAB_META[tabKey];
  const Icon = meta.icon;

  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onSelect}
      className={cn(
        "h-auto gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-none",
        active && "shadow-md shadow-accent/10",
        !active && "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon size={14} aria-hidden />
      {meta.label}
      <span
        className={cn(
          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums normal-case",
          active ? "bg-background/20" : "bg-card/80"
        )}
      >
        {meta.count}
      </span>
    </Button>
  );
}
