"use client";

import { useMemo, useState } from "react";
import { Bot, ExternalLink, FileCode, Search, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  SKILLS,
  AGENTS,
  COMMANDS,
  GITHUB_REPO,
  type CatalogAgent,
  type CatalogCommand,
  type CatalogSkill,
} from "@/lib/catalog.generated";

type Tab = "skills" | "agents" | "commands";
type CatalogItem = CatalogSkill | CatalogAgent | CatalogCommand;

const TAB_META: Record<Tab, { label: string; icon: typeof Sparkles; count: number }> = {
  skills: { label: "Skills", icon: Sparkles, count: SKILLS.length },
  agents: { label: "Subagents", icon: Bot, count: AGENTS.length },
  commands: { label: "Commands", icon: Wrench, count: COMMANDS.length },
};

export default function Catalog() {
  const [tab, setTab] = useState<Tab>("skills");
  const [query, setQuery] = useState("");

  const items: CatalogItem[] = useMemo(() => {
    const source: CatalogItem[] =
      tab === "skills" ? SKILLS : tab === "agents" ? AGENTS : COMMANDS;
    if (!query.trim()) return source;
    const q = query.toLowerCase();
    return source.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [tab, query]);

  function renderExtras(item: CatalogItem) {
    const agent = (item as CatalogCommand).agent;
    const hint = (item as CatalogCommand).argumentHint;
    const tools = (item as CatalogAgent).tools;
    return (
      <>
        {agent && (
          <Badge variant="outline" className="shrink-0">
            {agent}
          </Badge>
        )}
        {hint && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">{hint}</p>
        )}
        {tools && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">tools: {tools}</p>
        )}
      </>
    );
  }

  return (
    <section id="catalog" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">The catalog</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Every skill, subagent, and command <span className="gradient-text">in the box.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Skills are methodology docs the main agent follows. Subagents are specialised workers
          the framework spawns for planning, research, verification, UI audits, and more. Commands
          are the slash-command entry points. All of this is scanned directly out of{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">skills/</code>,{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">agents/</code>, and{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">commands/gad/</code> at build
          time — this list stays in sync with the repo.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/40 p-1">
            {(Object.keys(TAB_META) as Tab[]).map((key) => {
              const meta = TAB_META[key];
              const Icon = meta.icon;
              const active = key === tab;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
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
            })}
          </div>
          <div className="relative flex-1 min-w-52 max-w-md">
            <Search
              size={14}
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder={`Filter ${TAB_META[tab].label.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-border/70 bg-card/40 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card/40 p-5 transition-colors hover:border-accent/60"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <code className="truncate rounded-md bg-background/60 px-2 py-1 font-mono text-xs text-accent">
                  {item.name}
                </code>
                {(item as CatalogCommand).agent && (
                  <Badge variant="outline" className="shrink-0">
                    {(item as CatalogCommand).agent}
                  </Badge>
                )}
              </div>
              <p className="flex-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
              {(item as CatalogCommand).argumentHint && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  {(item as CatalogCommand).argumentHint}
                </p>
              )}
              {(item as CatalogAgent).tools && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  tools: {(item as CatalogAgent).tools}
                </p>
              )}
              <a
                href={`${GITHUB_REPO}/blob/main/${item.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 self-start text-[11px] font-semibold text-accent transition-opacity hover:underline"
              >
                <FileCode size={11} aria-hidden />
                View source
                <ExternalLink size={10} aria-hidden />
              </a>
            </article>
          ))}
        </div>

        {items.length === 0 && (
          <p className="mt-8 rounded-2xl border border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
            No matches for &quot;{query}&quot;
          </p>
        )}
      </div>
    </section>
  );
}
