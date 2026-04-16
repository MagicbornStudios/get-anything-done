import Link from "next/link";
import { MarketingShell, SiteSection } from "@/components/site";
import { getEpigraph } from "@/lib/epigraphs";
import { ALL_TASKS, ALL_PHASES } from "@/lib/eval-data";
import { REGISTERED_PROJECTS } from "@/lib/project-config";

export const metadata = {
  title: "Planning Dashboard — GAD",
  description:
    "Cross-project planning hub linking to per-project Planning, Evolution, and System tabs.",
};

/** Count items whose status is not done/cancelled. */
function countOpen(
  items: readonly { status?: string }[],
): number {
  return items.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  ).length;
}

export default function PlanningDashboardPage() {
  const epigraph = getEpigraph("planning");

  // Build-time counts from the default (GAD) dataset — shown on the GAD card.
  // Per-project datasets are not yet available at this route; other projects
  // show "--" until project-scoped data loading lands.
  const gadOpenTasks = countOpen(ALL_TASKS);
  const gadPhaseCount = ALL_PHASES.length;

  return (
    <MarketingShell>
      <SiteSection cid="planning-dashboard-site-section">
        <div className="mx-auto max-w-4xl space-y-8 py-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Planning Dashboard
            </h1>
            {epigraph && (
              <blockquote className="mt-3 border-l-2 border-muted-foreground/30 pl-4 text-sm italic text-muted-foreground">
                <p>{epigraph.adapted}</p>
                <footer className="mt-1 text-xs not-italic">
                  — {epigraph.attribution}
                </footer>
              </blockquote>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Per-project planning, evolution, and system views. Select a
              project to drill in.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {REGISTERED_PROJECTS.filter((p) => p.kind !== "evals").map(
              (project) => {
                const isGad = project.id === "get-anything-done";
                const openTasks = isGad ? gadOpenTasks : null;
                const phases = isGad ? gadPhaseCount : null;

                return (
                  <div
                    key={project.id}
                    className="rounded-lg border border-border bg-card p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold leading-tight">
                      {project.id}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {project.kind}
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-sm tabular-nums text-muted-foreground">
                      <span>
                        Phases: {phases !== null ? phases : "--"}
                      </span>
                      <span>
                        Open tasks: {openTasks !== null ? openTasks : "--"}
                      </span>
                    </div>

                    <nav className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/projects/${project.id}?tab=planning`}
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        Planning
                      </Link>
                      <Link
                        href={`/projects/${project.id}?tab=evolution`}
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        Evolution
                      </Link>
                      <Link
                        href={`/projects/${project.id}?tab=system`}
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        System
                      </Link>
                    </nav>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </SiteSection>
    </MarketingShell>
  );
}
