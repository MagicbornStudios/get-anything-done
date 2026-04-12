"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SkillsSearchField } from "./SkillsSearchField";
import type { SkillUsageDTO } from "./skills-page-types";

export function SkillsUsageTab({ usage }: { usage: SkillUsageDTO[] }) {
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
        <SkillsSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search skill usage…"
        />
        <p className="text-xs text-muted-foreground">
          {usage.length} skills tagged · {totalTasks} task-attributions total
        </p>
      </div>

      {usage.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-200">
          No skill attribution data yet. Tasks must include{" "}
          <code className="rounded bg-background/60 px-1">skill=&quot;...&quot;</code> on{" "}
          <code className="rounded bg-background/60 px-1">status=&quot;done&quot;</code> to appear here.
          Per{" "}
          <Link href="/decisions#gad-104" className="underline">
            GAD-D-104
          </Link>
          , attribution is mandatory — enforcement is landing in the next build.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.skill} className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="flex flex-wrap items-center gap-3">
                {u.isCatalogMatch ? (
                  <Link
                    href={`/skills/${u.skill}`}
                    className="font-mono text-sm font-semibold text-accent hover:underline"
                  >
                    {u.skill}
                  </Link>
                ) : (
                  <span className="font-mono text-sm font-semibold text-muted-foreground">{u.skill}</span>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {u.count} {u.count === 1 ? "task" : "tasks"}
                </Badge>
                {!u.isCatalogMatch && (
                  <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-300">
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
                      <span className="line-clamp-1 text-muted-foreground">{t.goal}</span>
                    </li>
                  ))}
                  {u.tasks.length > 25 && (
                    <li className="text-[10px] text-muted-foreground/60">+ {u.tasks.length - 25} more</li>
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
