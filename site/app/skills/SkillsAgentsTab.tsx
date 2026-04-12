"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SkillsSearchField } from "./SkillsSearchField";
import type { AgentUsageDTO } from "./skills-page-types";

export function SkillsAgentsTab({ agents }: { agents: AgentUsageDTO[] }) {
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
        <SkillsSearchField value={query} onChange={setQuery} placeholder="Search agents…" />
        <p className="text-xs text-muted-foreground">
          {agents.length} unique agents in attribution data
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-200">
          No agent attribution data yet. Tasks must include{" "}
          <code className="rounded bg-background/60 px-1">agent=&quot;...&quot;</code> to appear here
          (e.g. <code className="rounded bg-background/60 px-1">agent=&quot;claude-code&quot;</code>,{" "}
          <code className="rounded bg-background/60 px-1">agent=&quot;codex&quot;</code>, or a named
          subagent).
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((a) => (
            <div key={a.agent} className="rounded-xl border border-border/60 bg-card/40 p-4">
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
