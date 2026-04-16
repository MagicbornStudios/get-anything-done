"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types (mirrored from planning-skill-candidates-types, kept local to avoid
// cross-route import of planning/ internals)
// ---------------------------------------------------------------------------

interface SkillCandidateTask {
  id: string;
  status: string;
  goal: string;
}

type ReviewState = false | "promoted" | "merged" | "discarded";

interface SkillCandidate {
  name: string;
  source_phase: string;
  source_phase_title: string;
  pressure_score: number;
  tasks_total: number;
  tasks_done: number;
  crosscuts: number;
  file_path: string;
  reviewed: ReviewState;
  reviewed_on: string | null;
  reviewed_notes: string | null;
  tasks: SkillCandidateTask[];
  stage?: "candidate" | "drafted";
  proto_skill_dir?: string | null;
}

type FilterMode = "all" | "unreviewed" | "reviewed";

interface WorkflowSignal {
  totalEvents: number;
  agentSplit: { default: number; sub: number; byRole: Record<string, number> };
  topFiles: { path: string; count: number }[];
  topSkills: { skill: string; count: number }[];
  toolMix: Record<string, { count: number; pct: number }>;
}

interface PlanningPhase {
  id: string;
  title: string;
  status: string;
}

interface PlanningTask {
  id: string;
  goal: string;
  status: string;
  phase: string;
  type: string;
  skill: string;
}

interface PlanningPayload {
  tasks?: PlanningTask[];
  phases?: PlanningPhase[];
}

// ---------------------------------------------------------------------------
// Subtabs
// ---------------------------------------------------------------------------

const EVOLUTION_SUBTABS = [
  { key: "workflows", label: "Workflows" },
  { key: "skill-candidates", label: "Skill Candidates" },
  { key: "proto-skills", label: "Proto-skills" },
] as const;

type EvolutionSubTab = (typeof EVOLUTION_SUBTABS)[number]["key"];

// ---------------------------------------------------------------------------
// Review badge colors
// ---------------------------------------------------------------------------

const REVIEW_COLORS: Record<string, string> = {
  promoted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  merged: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  discarded: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function ProjectEvolutionTab({ projectId }: { projectId: string }) {
  const [subTab, setSubTab] = useState<EvolutionSubTab>("workflows");
  const [planning, setPlanning] = useState<PlanningPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/dev/evals/projects/${encodeURIComponent(projectId)}/planning`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: PlanningPayload) => {
        if (!cancelled) setPlanning(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div data-cid="project-evolution-tab-site-section" className="mx-auto max-w-5xl px-4 py-8">
      {/* subtab strip */}
      <div className="mb-6 flex gap-0 border-b border-border/40">
        {EVOLUTION_SUBTABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubTab(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              subTab === tab.key
                ? "border-b-2 border-accent text-accent"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Loading evolution data...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          Failed to load evolution data: {error}
        </div>
      )}

      {!loading && !error && subTab === "workflows" && (
        <WorkflowsSection planning={planning} projectId={projectId} />
      )}
      {!loading && !error && subTab === "skill-candidates" && (
        <SkillCandidatesSection planning={planning} />
      )}
      {!loading && !error && subTab === "proto-skills" && (
        <ProtoSkillsSection planning={planning} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflows section
// ---------------------------------------------------------------------------

function WorkflowsSection({
  planning,
  projectId,
}: {
  planning: PlanningPayload | null;
  projectId: string;
}) {
  const phases = planning?.phases ?? [];
  const tasks = planning?.tasks ?? [];

  const donePhases = phases.filter((p) => p.status === "done");
  const inProgressPhases = phases.filter((p) => p.status === "in-progress" || p.status === "active");

  // Derive a simple agent-split proxy from task attribution
  const tasksBySkill = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks) {
      const skill = t.skill || "unattributed";
      map[skill] = (map[skill] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [tasks]);

  const tasksByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks) {
      const type = t.type || "untyped";
      map[type] = (map[type] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Workflow evolution for <strong className="text-foreground">{projectId}</strong>.
        Derived from planning data -- phases, task attribution, and skill usage.
      </p>

      {/* Phase progress band */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Phase progress
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCell label="Total phases" value={phases.length} />
          <StatCell label="Done" value={donePhases.length} accent="text-emerald-400" />
          <StatCell label="In progress" value={inProgressPhases.length} accent="text-accent" />
        </div>
      </section>

      {/* Task type distribution */}
      {tasksByType.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Task type distribution
          </h3>
          <div className="space-y-1.5">
            {tasksByType.map(([type, count]) => {
              const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
              return (
                <div key={type} className="flex items-center gap-3 text-xs">
                  <span className="w-28 shrink-0 font-mono text-foreground/90">{type}</span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded-sm border border-border/60 bg-muted/20">
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan-500/30"
                      style={{ width: `${Math.max(0.5, pct)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Skill usage */}
      {tasksBySkill.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top skills used
          </h3>
          <div className="overflow-x-auto rounded-md border border-border/60 bg-muted/10">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Skill</th>
                  <th className="px-3 py-2 text-right font-medium">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {tasksBySkill.map(([skill, count]) => (
                  <tr key={skill} className="border-b border-border/40 last:border-b-0">
                    <td className="px-3 py-1.5 font-mono text-foreground/90">{skill}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tasks.length === 0 && phases.length === 0 && (
        <EmptyState message="No workflow data available for this project. Planning docs may not contain task or phase data." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill Candidates section
// ---------------------------------------------------------------------------

function SkillCandidatesSection({ planning }: { planning: PlanningPayload | null }) {
  const [filter, setFilter] = useState<FilterMode>("unreviewed");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Derive skill candidates from high-pressure phases in planning data.
  // In the global /planning page these come from the prebuild pipeline.
  // For project-scoped, we synthesize from tasks: phases with many tasks
  // and cross-cutting skill usage are candidates.
  const candidates = useMemo(() => {
    const tasks = planning?.tasks ?? [];
    const phases = planning?.phases ?? [];
    if (phases.length === 0) return [];

    const phaseMap = new Map(phases.map((p) => [p.id, p]));
    const tasksByPhase: Record<string, PlanningTask[]> = {};
    for (const t of tasks) {
      const phaseId = t.phase || "unknown";
      if (!tasksByPhase[phaseId]) tasksByPhase[phaseId] = [];
      tasksByPhase[phaseId].push(t);
    }

    const result: SkillCandidate[] = [];
    for (const [phaseId, phaseTasks] of Object.entries(tasksByPhase)) {
      const skills = new Set(phaseTasks.map((t) => t.skill).filter(Boolean));
      const crosscuts = skills.size;
      const pressure = phaseTasks.length + crosscuts * 2;
      // Only surface phases above a modest pressure threshold
      if (pressure < 8) continue;

      const phase = phaseMap.get(phaseId);
      const doneTasks = phaseTasks.filter((t) => t.status === "done").length;

      result.push({
        name: `candidate-phase-${phaseId}`,
        source_phase: phaseId,
        source_phase_title: phase?.title ?? `Phase ${phaseId}`,
        pressure_score: pressure,
        tasks_total: phaseTasks.length,
        tasks_done: doneTasks,
        crosscuts,
        file_path: `.planning/phases/${phaseId}/`,
        reviewed: false,
        reviewed_on: null,
        reviewed_notes: null,
        tasks: phaseTasks.map((t) => ({ id: t.id, status: t.status, goal: t.goal })),
      });
    }

    return result.sort((a, b) => b.pressure_score - a.pressure_score);
  }, [planning]);

  const filtered = useMemo(() => {
    if (filter === "all") return candidates;
    if (filter === "unreviewed") return candidates.filter((c) => c.reviewed === false);
    return candidates.filter((c) => c.reviewed !== false);
  }, [candidates, filter]);

  const counts = useMemo(() => {
    const unreviewed = candidates.filter((c) => c.reviewed === false).length;
    const reviewed = candidates.length - unreviewed;
    return { unreviewed, reviewed, all: candidates.length };
  }, [candidates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Skill candidates from high-pressure phases
        </h3>
        <div className="ml-auto flex items-center gap-1.5">
          {(["unreviewed", "reviewed", "all"] as const).map((mode) => {
            const isActive = filter === mode;
            const count = counts[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                  isActive
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
                )}
              >
                {mode}
                <span className="tabular-nums text-muted-foreground/70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            filter === "unreviewed"
              ? "All candidates have been reviewed."
              : filter === "reviewed"
                ? "No candidates have been reviewed yet."
                : "No high-pressure phases detected for this project."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => (
            <CandidateCard
              key={c.name}
              candidate={c}
              isOpen={expanded === c.name}
              onToggle={() => setExpanded(expanded === c.name ? null : c.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proto-skills section
// ---------------------------------------------------------------------------

function ProtoSkillsSection({ planning }: { planning: PlanningPayload | null }) {
  // Proto-skills are candidates that reached "drafted" stage.
  // For now, derived from the same planning data -- phases where
  // a dominant skill emerged and tasks completed successfully.
  const tasks = planning?.tasks ?? [];
  const phases = planning?.phases ?? [];

  const protoSkills = useMemo(() => {
    if (phases.length === 0) return [];

    const tasksByPhase: Record<string, PlanningTask[]> = {};
    for (const t of tasks) {
      const phaseId = t.phase || "unknown";
      if (!tasksByPhase[phaseId]) tasksByPhase[phaseId] = [];
      tasksByPhase[phaseId].push(t);
    }

    const results: {
      phaseId: string;
      phaseTitle: string;
      dominantSkill: string;
      taskCount: number;
      doneCount: number;
      completionRate: number;
    }[] = [];

    for (const [phaseId, phaseTasks] of Object.entries(tasksByPhase)) {
      const doneTasks = phaseTasks.filter((t) => t.status === "done");
      if (doneTasks.length < 3) continue;

      const skillCounts: Record<string, number> = {};
      for (const t of doneTasks) {
        const skill = t.skill || "unattributed";
        skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
      }

      const sorted = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
      const [dominant, dominantCount] = sorted[0] ?? ["none", 0];
      const dominanceRatio = doneTasks.length > 0 ? dominantCount / doneTasks.length : 0;

      // Only surface phases where a single skill dominated (>50% of done tasks)
      if (dominanceRatio < 0.5 || dominant === "unattributed") continue;

      const phase = phases.find((p) => p.id === phaseId);
      results.push({
        phaseId,
        phaseTitle: phase?.title ?? `Phase ${phaseId}`,
        dominantSkill: dominant,
        taskCount: phaseTasks.length,
        doneCount: doneTasks.length,
        completionRate: Math.round((doneTasks.length / phaseTasks.length) * 100),
      });
    }

    return results.sort((a, b) => b.completionRate - a.completionRate);
  }, [tasks, phases]);

  if (protoSkills.length === 0) {
    return (
      <EmptyState message="No proto-skills detected. Proto-skills emerge when a single skill dominates a phase with high task completion." />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Phases where a single skill dominated task completion. These are candidates for
        crystallization into standalone, reusable skills.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {protoSkills.map((ps) => (
          <div
            key={ps.phaseId}
            className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Phase {ps.phaseId}
              </Badge>
              <Badge variant="default" className="border-transparent bg-violet-500/15 text-violet-400 text-[10px]">
                {ps.dominantSkill}
              </Badge>
            </div>
            <h4 className="text-sm font-semibold text-foreground">{ps.phaseTitle}</h4>
            <dl className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <dt className="uppercase tracking-wider text-muted-foreground/70">Tasks</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {ps.doneCount}/{ps.taskCount}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider text-muted-foreground/70">Completion</dt>
                <dd className="font-medium tabular-nums text-foreground">{ps.completionRate}%</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider text-muted-foreground/70">Dominant</dt>
                <dd className="font-medium text-violet-400">{ps.dominantSkill}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function CandidateCard({
  candidate,
  isOpen,
  onToggle,
}: {
  candidate: SkillCandidate;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isReviewed = candidate.reviewed !== false;

  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        isReviewed ? "border-border/40 bg-card/20 opacity-80" : "border-border/60 bg-card/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          Phase {candidate.source_phase}
        </Badge>
        <Badge variant="default" className="border-transparent bg-amber-500/15 text-amber-400">
          pressure {candidate.pressure_score}
        </Badge>
        {isReviewed && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              REVIEW_COLORS[candidate.reviewed as string] ?? "border-border/50 text-muted-foreground",
            )}
          >
            {candidate.reviewed}
          </span>
        )}
      </div>

      <h4 className="mt-3 text-sm font-semibold text-foreground">{candidate.source_phase_title}</h4>
      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground/70">{candidate.file_path}</p>

      {isReviewed && candidate.reviewed_notes && (
        <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Review notes {candidate.reviewed_on && `-- ${candidate.reviewed_on}`}
          </p>
          <p className="mt-1 text-xs leading-5 text-foreground">{candidate.reviewed_notes}</p>
        </div>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="uppercase tracking-wider text-muted-foreground/70">Tasks</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {candidate.tasks_done}/{candidate.tasks_total}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-muted-foreground/70">Crosscuts</dt>
          <dd className="font-medium tabular-nums text-foreground">{candidate.crosscuts}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-muted-foreground/70">Score</dt>
          <dd className="font-medium tabular-nums text-amber-400">{candidate.pressure_score}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <button type="button" onClick={onToggle} className="text-[11px] font-semibold text-accent hover:underline">
          {isOpen ? "Hide" : "Show"} source phase tasks ({candidate.tasks.length})
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
          {candidate.tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-[11px]">
              <span className="shrink-0 font-mono text-muted-foreground">{t.id}</span>
              <Badge variant="outline" className="shrink-0 text-[9px] uppercase">
                {t.status}
              </Badge>
              <p className="line-clamp-2 flex-1 leading-4 text-muted-foreground">{t.goal}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", accent ?? "text-foreground")}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}
