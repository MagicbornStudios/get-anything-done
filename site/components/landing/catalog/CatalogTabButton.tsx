"use client";

import { TAB_META, type CatalogTab } from "@/components/landing/catalog/catalog-shared";

type Props = {
  tabKey: CatalogTab;
  active: boolean;
  onSelect: () => void;
};

export function CatalogTabButton({ tabKey, active, onSelect }: Props) {
  const meta = TAB_META[tabKey];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
        active
          ? "bg-accent text-accent-foreground shadow-md shadow-accent/10"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <Icon size={14} aria-hidden />
      {meta.label}
      <span
        className={[
          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums",
          active ? "bg-background/20" : "bg-card/80",
        ].join(" ")}
      >
        {meta.count}
      </span>
    </button>
  );
}
