"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DETAIL_PREFIX, type CatalogItem, type CatalogTab } from "@/components/landing/catalog/catalog-shared";
import type { CatalogAgent, CatalogCommand } from "@/lib/catalog.generated";

type Props = {
  item: CatalogItem;
  tab: CatalogTab;
  inherited: string[];
};

export function CatalogItemLink({ item, tab, inherited }: Props) {
  const detailHref = `${DETAIL_PREFIX[tab]}/${item.id}`;
  const command = item as CatalogCommand;
  const agent = item as CatalogAgent;

  return (
    <Link
      href={detailHref}
      className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card/40 p-5 transition-colors hover:border-accent/60"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <code className="truncate rounded-md bg-background/60 px-2 py-1 font-mono text-xs text-accent">
          {item.name}
        </code>
        {command.agent && (
          <Badge variant="outline" className="shrink-0">
            {command.agent}
          </Badge>
        )}
      </div>
      <p className="flex-1 text-sm leading-6 text-muted-foreground">
        {item.description}
      </p>
      {command.argumentHint && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          {command.argumentHint}
        </p>
      )}
      {agent.tools && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          tools: {agent.tools}
        </p>
      )}
      {tab === "skills" && inherited.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider">inherited by:</span>
          {inherited.map((project) => (
            <code
              key={project}
              className="rounded-sm bg-emerald-500/10 px-1 py-0.5 text-emerald-300"
            >
              {project.replace("escape-the-dungeon", "etd")}
            </code>
          ))}
        </div>
      )}
      {tab === "skills" && inherited.length === 0 && (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
          framework-only
        </p>
      )}
      <span className="mt-4 inline-flex items-center gap-1 self-start text-[11px] font-semibold text-accent">
        Read detail
        <ArrowRight size={10} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
