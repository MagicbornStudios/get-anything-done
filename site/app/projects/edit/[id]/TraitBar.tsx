"use client";

import { useEffect, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";

export type Trait = {
  key: string;
  label: string;
  value: number; // 0-1
  description?: string;
};

function Bar({ trait }: { trait: Trait }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Animate from 0 on mount
    const raf = requestAnimationFrame(() => setWidth(trait.value));
    return () => cancelAnimationFrame(raf);
  }, [trait.value]);

  const color =
    trait.value > 0.7
      ? "bg-emerald-500"
      : trait.value >= 0.3
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="group flex items-center gap-2 py-1" title={trait.description}>
      <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground">
        {trait.label}
      </span>
      <div className="relative flex-1 h-3 rounded bg-border/30">
        <div
          className={cn("absolute inset-y-0 left-0 rounded transition-all duration-700 ease-out", color)}
          style={{ width: `${width * 100}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] font-mono text-foreground/70">
        {(trait.value * 100).toFixed(0)}%
      </span>
      {trait.description && (
        <div className="pointer-events-none absolute left-0 -top-8 z-50 hidden group-hover:block rounded bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-md max-w-[200px]">
          {trait.description}
        </div>
      )}
    </div>
  );
}

export function TraitBar({ traits, title }: { traits: Trait[]; title?: string }) {
  if (traits.length === 0) return null;

  return (
    <SiteSection
      cid="project-editor-trait-bar-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="px-3 py-2">
        {title && (
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {title}
          </h3>
        )}
        <div className="space-y-0.5">
          {traits.map((t) => (
            <Bar key={t.key} trait={t} />
          ))}
        </div>
      </div>
    </SiteSection>
  );
}
