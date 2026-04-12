import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import type { PlanningState } from "@/lib/catalog.generated";

export function PlanningOverviewSection({ state }: { state: PlanningState }) {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Planning state"
        as="h1"
        preset="hero-compact"
        title={
          <>
            What&apos;s in flight <span className="gradient-text">right now.</span>
          </>
        }
      />
      <SiteProse className="mt-5">
        This page is built from{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">.planning/STATE.xml</code>,{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TASK-REGISTRY.xml</code>, and{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">DECISIONS.xml</code> at the
        get-anything-done repo root. The site — including this very page — is being developed as phase
        22 of the GAD v1.1 milestone. When we update those files, a redeploy picks up the new state
        automatically.
      </SiteProse>

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
            <CardTitle className="text-4xl tabular-nums text-accent">{state.openTasks.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            excluding done and cancelled
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tasks completed</CardDescription>
            <CardTitle className="text-4xl tabular-nums text-emerald-400">{state.doneTasksCount}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            across the full project history
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last updated</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{state.lastUpdated ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">STATE.xml</CardContent>
        </Card>
      </div>
    </SiteSection>
  );
}
