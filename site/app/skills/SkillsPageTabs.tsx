"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SkillSummaryDTO {
  id: string;
  name: string;
  description: string;
  inheritedBy: string[];
  isFundamental: boolean;
  isFrameworkSkill: boolean;
  authoredByEvals: string[];
  category: string; // fundamental | eval-authored | framework-inherited | framework-only
}

export interface SkillUsageDTO {
  skill: string;
  count: number;
  tasks: { id: string; phaseId: string; status: string; goal: string }[];
  isCatalogMatch: boolean;
}

export interface AgentUsageDTO {
  agent: string;
  count: number;
  tasksByType: Record<string, number>;
  skills: string[];
}

const CATEGORY_LABEL: Record<string, string> = {
  fundamental: "Fundamental",
  "eval-authored": "Eval-authored",
  "framework-inherited": "Framework — inherited",
  "framework-only": "Framework — not inherited",
};

const CATEGORIES = [
  "all",
  "fundamental",
  "eval-authored",
  "framework-inherited",
  "framework-only",
];

export function SkillsPageTabs({
  summaries,
  usage,
  agents,
}: {
  summaries: SkillSummaryDTO[];
  usage: SkillUsageDTO[];
  agents: AgentUsageDTO[];
}) {
  return (
    <Tabs defaultValue="catalog" className="w-full">
      <TabsList className="flex w-full max-w-xl flex-wrap justify-start gap-1 bg-card/40">
        <TabsTrigger value="catalog">
          Catalog <span className="ml-1.5 text-muted-foreground/70">{summaries.length}</span>
        </TabsTrigger>
        <TabsTrigger value="usage">
          Usage <span className="ml-1.5 text-muted-foreground/70">{usage.length}</span>
        </TabsTrigger>
        <TabsTrigger value="agents">
          Agents <span className="ml-1.5 text-muted-foreground/70">{agents.length}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="catalog" className="mt-6">
        <CatalogTab summaries={summaries} />
      </TabsContent>

      <TabsContent value="usage" className="mt-6">
        <UsageTab usage={usage} />
      </TabsContent>

      <TabsContent value="agents" className="mt-6">
        <AgentsTab agents={agents} />
      </TabsContent>
    </Tabs>
  );
}

function CatalogTab({ summaries }: { summaries: SkillSummaryDTO[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    return summaries.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });
  }, [summaries, query, category]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            className="w-full rounded-lg border border-border/60 bg-card/40 px-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent/70 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={[
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                category === cat
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
              ].join(" ")}
            >
              {cat === "all" ? "All" : CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills match.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <CatalogCard key={s.id} skill={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogCard({ skill }: { skill: SkillSummaryDTO }) {
  return (
    <Link href={`/skills/${skill.id}`} className="block">
      <Card className="h-full transition-colors hover:border-accent/60">
        <CardHeader className="pb-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {skill.isFundamental && (
              <Badge variant="default" className="bg-amber-500/15 text-amber-300">
                fundamental
              </Badge>
            )}
            {skill.isFrameworkSkill && (
              <Badge variant="outline" className="border-violet-500/50 text-violet-300">
                Framework
              </Badge>
            )}
            {skill.authoredByEvals.length > 0 && (
              <Badge variant="outline" className="text-emerald-300">
                eval-authored
              </Badge>
            )}
          </div>
          <CardTitle className="font-mono text-base">{skill.id}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
            {skill.description}
          </p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {skill.inheritedBy.length > 0
                ? `inherited by ${skill.inheritedBy.length}`
                : "framework-only"}
            </span>
            <ArrowRight size={11} aria-hidden />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function UsageTab({ usage }: { usage: SkillUsageDTO[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      usage.filter((u) =>
        !query ? true : u.skill.toLowerCase().includes(query.toLowerCase()),
      ),
    [usage, query],
  );
  const maxCount = Math.max(1, ...usage.map((u) => u.count));
  const totalTasks = usage.reduce((sum, u) => sum + u.count, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skill usage…"
            className="w-full rounded-lg border border-border/60 bg-card/40 px-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent/70 focus:outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {usage.length} skills tagged · {totalTasks} task-attributions total
        </p>
      </div>

      {usage.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-200">
          No skill attribution data yet. Tasks must include <code className="rounded bg-background/60 px-1">skill=&quot;...&quot;</code> on <code className="rounded bg-background/60 px-1">status=&quot;done&quot;</code> to appear here. Per{" "}
          <Link href="/decisions#gad-104" className="underline">GAD-D-104</Link>, attribution is mandatory — enforcement is landing in the next build.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div
              key={u.skill}
              className="rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                {u.isCatalogMatch ? (
                  <Link
                    href={`/skills/${u.skill}`}
                    className="font-mono text-sm font-semibold text-accent hover:underline"
                  >
                    {u.skill}
                  </Link>
                ) : (
                  <span className="font-mono text-sm font-semibold text-muted-foreground">
                    {u.skill}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {u.count} {u.count === 1 ? "task" : "tasks"}
                </Badge>
                {!u.isCatalogMatch && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-300 text-[10px]"
                  >
                    no catalog match
                  </Badge>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full bg-accent/60"
                  style={{ width: `${(u.count / maxCount) * 100}%` }}
                />
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-accent">
                  {u.tasks.length} attributed task(s)
                </summary>
                <ul className="mt-2 space-y-1 text-[11px]">
                  {u.tasks.slice(0, 25).map((t) => (
                    <li key={t.id} className="flex items-start gap-2">
                      <span className="font-mono text-accent">{t.id}</span>
                      <span className="text-muted-foreground line-clamp-1">{t.goal}</span>
                    </li>
                  ))}
                  {u.tasks.length > 25 && (
                    <li className="text-[10px] text-muted-foreground/60">
                      + {u.tasks.length - 25} more
                    </li>
                  )}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentsTab({ agents }: { agents: AgentUsageDTO[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      agents.filter((a) =>
        !query ? true : a.agent.toLowerCase().includes(query.toLowerCase()),
      ),
    [agents, query],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            className="w-full rounded-lg border border-border/60 bg-card/40 px-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent/70 focus:outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {agents.length} unique agents in attribution data
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-200">
          No agent attribution data yet. Tasks must include{" "}
          <code className="rounded bg-background/60 px-1">agent=&quot;...&quot;</code> to appear
          here (e.g. <code className="rounded bg-background/60 px-1">agent=&quot;claude-code&quot;</code>,{" "}
          <code className="rounded bg-background/60 px-1">agent=&quot;codex&quot;</code>, or a named subagent).
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((a) => (
            <div
              key={a.agent}
              className="rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-sm font-semibold text-foreground">{a.agent}</h3>
                <Badge variant="outline" className="text-[10px]">
                  {a.count} tasks
                </Badge>
              </div>
              {Object.keys(a.tasksByType).length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    By type
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(a.tasksByType)
                      .sort((x, y) => y[1] - x[1])
                      .map(([type, n]) => (
                        <span
                          key={type}
                          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px]"
                        >
                          <span className="text-muted-foreground">{type}</span>
                          <span className="tabular-nums text-foreground">{n}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {a.skills.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Skills used
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.skills.slice(0, 12).map((s) => (
                      <Link
                        key={s}
                        href={`/skills/${s}`}
                        className="inline-flex items-center rounded border border-accent/30 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-accent/10"
                      >
                        {s}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
