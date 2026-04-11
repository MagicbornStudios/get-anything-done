import Link from "next/link";
import { ListTodo, Github, Check, CircleDot, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { ALL_TASKS, type TaskRecord } from "@/lib/eval-data";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Tasks — GAD",
  description:
    "Every task in .planning/TASK-REGISTRY.xml rendered with stable anchors. Grouped by phase, filtered by status.",
};

const REPO = "https://github.com/MagicbornStudios/get-anything-done";
const TASK_FILE_URL = `${REPO}/blob/main/.planning/TASK-REGISTRY.xml`;

const STATUS_TINT: Record<string, "success" | "default" | "outline" | "danger"> = {
  done: "success",
  "in-progress": "default",
  blocked: "danger",
  planned: "outline",
  cancelled: "outline",
};

const STATUS_ICON: Record<string, React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>> = {
  done: Check,
  "in-progress": CircleDot,
  blocked: X,
  planned: CircleDot,
  cancelled: X,
};

function groupByPhase(tasks: TaskRecord[]) {
  const groups = new Map<string, TaskRecord[]>();
  for (const t of tasks) {
    const arr = groups.get(t.phaseId) ?? [];
    arr.push(t);
    groups.set(t.phaseId, arr);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default function TasksPage() {
  const open = ALL_TASKS.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = ALL_TASKS.filter((t) => t.status === "done");
  const cancelled = ALL_TASKS.filter((t) => t.status === "cancelled");
  const byPhase = groupByPhase(ALL_TASKS);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Tasks</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Every task, every phase.{" "}
            <span className="gradient-text">Permalink per task.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            This page renders every entry in{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-sm">
              .planning/TASK-REGISTRY.xml
            </code>
            , grouped by phase. Every task has a stable anchor so other pages can link to{" "}
            <Ref id="22-01" /> etc. directly.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            <a
              href={TASK_FILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted"
            >
              Source: TASK-REGISTRY.xml on GitHub
            </a>
          </p>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Stat label="Total" value={ALL_TASKS.length.toString()} />
            <Stat label="Open" value={open.length.toString()} />
            <Stat label="Done" value={done.length.toString()} />
            <Stat label="Cancelled" value={cancelled.length.toString()} />
            <Stat label="Phases" value={byPhase.length.toString()} />
          </div>
        </div>
      </section>

      {byPhase.map(([phaseId, tasks]) => (
        <section
          key={phaseId}
          id={`phase-${phaseId}`}
          className="border-b border-border/60 bg-card/20 last:bg-background"
        >
          <div className="section-shell">
            <div className="mb-6 flex items-center gap-3">
              <ListTodo size={18} className="text-accent" aria-hidden />
              <p className="section-kicker !mb-0">Phase {phaseId}</p>
              <Link
                href={`/phases#${phaseId}`}
                className="inline-flex items-center rounded border border-purple-500/40 bg-purple-500/5 px-1.5 py-0.5 font-mono text-[10px] text-purple-300 hover:bg-purple-500/15"
              >
                P-{phaseId}
              </Link>
              <Badge variant="outline">{tasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <Footer />
    </main>
  );
}

function TaskCard({ task }: { task: TaskRecord }) {
  const Icon = STATUS_ICON[task.status] ?? CircleDot;
  return (
    <Card id={task.id} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Ref id={task.id} />
            <Badge variant={STATUS_TINT[task.status] ?? "outline"} className="inline-flex items-center gap-1">
              <Icon size={10} aria-hidden />
              {task.status}
            </Badge>
          </div>
          <Link
            href={`#${task.id}`}
            className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
          >
            #{task.id}
          </Link>
        </div>
        <CardTitle className="mt-2 text-sm font-normal leading-6 text-foreground/90">
          {task.goal}
        </CardTitle>
      </CardHeader>
      {(task.keywords.length > 0 || task.depends.length > 0) && (
        <CardContent className="pt-0">
          {task.keywords.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
              {task.keywords.map((k) => (
                <span key={k} className="rounded bg-background/60 px-1.5 py-0.5">
                  {k}
                </span>
              ))}
            </div>
          )}
          {task.depends.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="uppercase tracking-wider">depends on:</span>
              {task.depends.map((d) => (
                <Ref key={d} id={d} />
              ))}
            </div>
          )}
        </CardContent>
      )}
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
