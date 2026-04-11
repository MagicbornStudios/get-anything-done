import Link from "next/link";
import { GitBranch, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { ALL_PHASES, ALL_TASKS, type PhaseRecord } from "@/lib/eval-data";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Phases — GAD",
  description:
    "Every phase in .planning/ROADMAP.xml rendered with task counts, status, and deep-links to individual tasks.",
};

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

const STATUS_TINT: Record<string, "success" | "default" | "outline"> = {
  done: "success",
  "in-progress": "default",
  active: "default",
  planned: "outline",
  blocked: "outline",
};

function tasksForPhase(phaseId: string) {
  return ALL_TASKS.filter((t) => t.phaseId === phaseId);
}

export default function PhasesPage() {
  const phases = ALL_PHASES.slice().sort((a, b) => {
    const an = parseFloat(a.id);
    const bn = parseFloat(b.id);
    return an - bn;
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Phases</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            The project, in phases.{" "}
            <span className="gradient-text">One milestone at a time.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Phases are the unit of project work in GAD — each one defines a goal, a set
            of tasks, and an expected outcome. This page renders every phase in{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-sm">
              .planning/ROADMAP.xml
            </code>{" "}
            with its task list and status. Distinct from <Link
              href="/roadmap"
              className="text-accent underline decoration-dotted"
            >
              /roadmap
            </Link>{" "}
            which tracks eval rounds.
          </p>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Stat label="Phases" value={phases.length.toString()} />
            <Stat label="Tasks" value={ALL_TASKS.length.toString()} />
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <GitBranch size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">All phases</p>
          </div>
          <div className="space-y-4">
            {phases.map((p) => (
              <PhaseCard key={p.id} phase={p} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function PhaseCard({ phase }: { phase: PhaseRecord }) {
  const tasks = tasksForPhase(phase.id);
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const openCount = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <Card id={phase.id} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Ref id={`P-${phase.id}`} />
          <Badge variant={STATUS_TINT[phase.status] ?? "outline"}>{phase.status}</Badge>
          <CardTitle className="text-lg leading-tight">{phase.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {phase.goal && (
          <p className="text-sm leading-6 text-muted-foreground">{phase.goal}</p>
        )}
        {phase.outcome && (
          <p className="mt-3 border-l-2 border-accent/60 pl-3 text-xs leading-5 italic text-muted-foreground">
            Outcome: {phase.outcome}
          </p>
        )}

        {tasks.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-border/40 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  <strong className="text-foreground">{doneCount}</strong> done
                </span>
                <span className="opacity-40">·</span>
                <span>
                  <strong className="text-foreground">{openCount}</strong> open
                </span>
                <span className="opacity-40">·</span>
                <span>
                  <strong className="text-foreground">{tasks.length}</strong> total
                </span>
              </div>
              <Link
                href={`/tasks#phase-${phase.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                View all tasks
                <ArrowRight size={10} aria-hidden />
              </Link>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-background/60">
              <div
                className="h-full rounded-full bg-emerald-500/70"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {tasks.slice(0, 12).map((t) => (
                <Ref key={t.id} id={t.id} />
              ))}
              {tasks.length > 12 && (
                <span className="inline-flex items-center rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  +{tasks.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
