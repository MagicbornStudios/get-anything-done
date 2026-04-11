import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { PLANNING_STATE, GITHUB_REPO } from "@/lib/catalog.generated";

export const metadata = {
  title: "Planning state — GAD self-transparency",
  description:
    "The current phase, open tasks, and recent decisions driving the get-anything-done framework and this site. Parsed directly from .planning/ XML files.",
};

const STATUS_TINT: Record<string, string> = {
  done: "border-emerald-500/40 text-emerald-300",
  active: "border-sky-500/40 text-sky-300",
  planned: "border-amber-500/40 text-amber-300",
  cancelled: "border-border/60 text-muted-foreground",
};

export default function PlanningStatePage() {
  const state = PLANNING_STATE;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Planning state</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            What&apos;s in flight <span className="gradient-text">right now.</span>
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            This page is built from{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">.planning/STATE.xml</code>,{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TASK-REGISTRY.xml</code>, and{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">DECISIONS.xml</code> at the
            get-anything-done repo root. The site — including this very page — is being developed
            as phase 22 of the GAD v1.1 milestone. When we update those files, a redeploy picks up
            the new state automatically.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current phase</CardDescription>
                <CardTitle className="text-4xl tabular-nums gradient-text">
                  {state.currentPhase ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                milestone {state.milestone ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Open tasks</CardDescription>
                <CardTitle className="text-4xl tabular-nums text-accent">
                  {state.openTasks.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                excluding done and cancelled
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tasks completed</CardDescription>
                <CardTitle className="text-4xl tabular-nums text-emerald-400">
                  {state.doneTasksCount}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                across the full project history
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last updated</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {state.lastUpdated ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                STATE.xml
              </CardContent>
            </Card>
          </div>

          {state.nextAction && (
            <div className="mt-12 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
              <p className="section-kicker">Next action</p>
              <p className="mt-3 text-base leading-7 text-foreground whitespace-pre-line">
                {state.nextAction}
              </p>
            </div>
          )}
        </div>
      </section>

      {state.phases.length > 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Roadmap</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              All phases, status-coded
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {state.phases.map((phase) => (
                <div
                  key={phase.id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
                >
                  <span className="mt-0.5 inline-flex min-w-10 shrink-0 items-center justify-center rounded-full bg-background/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {phase.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{phase.title}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      STATUS_TINT[phase.status] ?? STATUS_TINT.planned
                    }`}
                  >
                    {phase.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {state.openTasks.length > 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Open tasks</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              What the agent is working on
            </h2>
            <div className="mt-8 space-y-3">
              {state.openTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/40 p-5"
                >
                  <code className="shrink-0 rounded-md bg-background/60 px-2 py-1 font-mono text-xs text-accent">
                    {task.id}
                  </code>
                  <div className="min-w-0 flex-1">
                    <Badge
                      variant="outline"
                      className={STATUS_TINT[task.status] ?? STATUS_TINT.planned}
                    >
                      {task.status}
                    </Badge>
                    <p className="mt-2 text-sm leading-6 text-foreground">{task.goal}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {state.recentDecisions.length > 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Recent decisions</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              The last {state.recentDecisions.length} architectural calls
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              DECISIONS.xml is where we record the "why" behind load-bearing choices. New decisions
              append to the bottom; this list is newest-first.
            </p>
            <div className="mt-8 space-y-4">
              {state.recentDecisions.map((d) => (
                <Card key={d.id}>
                  <CardHeader className="pb-2">
                    <div className="mb-1 flex items-center gap-2">
                      <code className="rounded-md bg-background/60 px-2 py-1 font-mono text-[11px] text-accent">
                        {d.id}
                      </code>
                    </div>
                    <CardTitle className="text-lg">{d.title}</CardTitle>
                  </CardHeader>
                  {d.summary && (
                    <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                      {d.summary}
                    </CardContent>
                  )}
                </Card>
              ))}
              <a
                href={`${GITHUB_REPO}/blob/main/.planning/DECISIONS.xml`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
              >
                Full decision log on GitHub
                <ExternalLink size={12} aria-hidden />
              </a>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
