import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import { SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";
import selfEvalConfig from "@/data/self-eval-config.json";
import selfEvalData from "@/data/self-eval.json";

export const metadata = {
  title: "Formulas — how GAD measures phase pressure and framework overhead",
  description:
    "Every formula GAD uses to score itself: pressure, framework overhead, loop compliance. Shannon-inspired framing for phase complexity and cross-cutting concerns.",
};

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block rounded-lg border border-border/60 bg-card/40 px-4 py-3 font-mono text-sm text-foreground">
      {children}
    </code>
  );
}

export default function FormulasPage() {
  const pressureCfg = selfEvalConfig.pressure;
  const crosscutCfg = selfEvalConfig.crosscut_detection;
  const overheadCfg = selfEvalConfig.framework_overhead;
  const latest = selfEvalData.latest;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <SiteSection>
        <SiteSectionHeading
          kicker="Formulas"
          as="h1"
          preset="hero-compact"
          title={
            <>
              Every number on this site <span className="gradient-text">has a formula.</span>
            </>
          }
        />
        <SiteProse className="mt-5">
          GAD scores itself continuously by reading its own planning artifacts and trace logs. This page documents every formula the{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">compute-self-eval.mjs</code> pipeline uses — pressure,
          framework overhead, loop compliance, crosscut detection — with the exact weights currently in effect. Weights are configurable in{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">site/data/self-eval-config.json</code>.
        </SiteProse>
      </SiteSection>

      {/* Pressure */}
      <SiteSection tone="muted" className="border-t border-border/60">
        <SiteSectionHeading kicker="Phase pressure" title="How hard was this phase, really?" />
        <SiteProse className="mt-5 max-w-4xl">
          Pressure is a Shannon-inspired approximation of the total information burden a phase imposed on whoever worked it. It combines <strong>raw task count</strong> (entropy H — the bits needed to describe the phase's workload) with <strong>crosscut count</strong> (mutual information I(X;Y) — tasks that span multiple subsystems, carrying information about both). Weighted sum approximates the agent's mental state requirement.
        </SiteProse>

        <div className="mt-6 space-y-4">
          <Formula>
            pressure = tasks_total + (crosscuts × crosscut_weight)
          </Formula>
          <Formula>
            high_pressure = pressure &gt; high_pressure_threshold
          </Formula>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                crosscut_weight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {pressureCfg.crosscut_weight}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Multiplier applied to crosscut count. Crosscuts are weighted heavily because cross-cutting
                work requires holding multiple system contexts simultaneously, roughly doubling the mental
                state an agent must hold.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                high_pressure_threshold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {pressureCfg.high_pressure_threshold}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Phases with pressure above this threshold are flagged as high-pressure and become skill
                candidate sources. Tuning this controls how many phases get drafted as candidates.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                systems tracked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {crosscutCfg.systems.length}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                A task is a crosscut when its goal text mentions at least{" "}
                <strong>{crosscutCfg.min_systems_to_count}</strong> of these subsystems.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Subsystems considered for crosscut detection
          </h3>
          <div className="flex flex-wrap gap-2">
            {crosscutCfg.systems.map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-accent/40 bg-accent/5 p-6">
          <h3 className="section-kicker">Shannon framing</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-foreground">
            This is an intentional nod to Claude Shannon's information theory. In the Shannon framing:
          </p>
          <ul className="mt-3 max-w-3xl space-y-2 text-sm leading-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">tasks_total ≈ H</strong> — raw entropy of the phase. Each task is
              an independent unit of work that adds uncertainty about "what needs to happen" until it's resolved.
              A phase with 50 tasks has more H than a phase with 5.
            </li>
            <li>
              <strong className="text-foreground">crosscuts ≈ I(X;Y)</strong> — mutual information between subsystems.
              When a task's goal mentions multiple subsystems (say <code className="text-accent">cli</code> +{" "}
              <code className="text-accent">site</code>), that task carries shared information about both. It can't
              be finished without understanding both. Crosscuts measure how entangled a phase is.
            </li>
            <li>
              <strong className="text-foreground">pressure ≈ total information burden</strong> — the weighted sum
              approximates how much state the agent had to hold to get through the phase. High pressure is a signal
              that patterns exist worth capturing as reusable skills (<Ref id="gad-115" />).
            </li>
          </ul>
          <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
            Caveat: this is an <em>approximation</em>, not formal information theory. Real entropy requires a
            probability distribution over task states; we use a proxy based on task counts and keyword-derived
            crosscuts. The goal is a useful signal that scales monotonically with complexity, not rigor.
          </p>
        </div>
      </SiteSection>

      {/* Framework overhead */}
      <SiteSection className="border-t border-border/60">
        <SiteSectionHeading kicker="Framework overhead" title="How much of the work is planning vs building?" />
        <SiteProse className="mt-5 max-w-4xl">
          Overhead measures the ratio of planning-file operations (reads/writes on .planning/ XML files) to total
          file operations. A healthy framework keeps overhead below 15%. Too high means you're maintaining the
          framework more than using it.
        </SiteProse>

        <div className="mt-6 space-y-4">
          <Formula>
            overhead_ratio = planning_ops / (planning_ops + source_ops)
          </Formula>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                ≤ excellent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-emerald-400">
                {(overheadCfg.score_thresholds.excellent * 100).toFixed(0)}%
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Score: 1.0 — framework stays out of the way</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                ≤ acceptable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-sky-400">
                {(overheadCfg.score_thresholds.acceptable * 100).toFixed(0)}%
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Score: 0.7 — tolerable cost</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                ≤ concerning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-amber-400">
                {(overheadCfg.score_thresholds.concerning * 100).toFixed(0)}%
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Score: 0.4 — ceremony is eating real work</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                &gt; concerning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-rose-400">
                &gt;{(overheadCfg.score_thresholds.concerning * 100).toFixed(0)}%
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Score: 0.1 — framework is the bottleneck</p>
            </CardContent>
          </Card>
        </div>

        {latest && (
          <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current snapshot</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-4">
              <p className="text-4xl font-semibold tabular-nums text-foreground">
                {(latest.framework_overhead.ratio * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">
                {latest.framework_overhead.planning_ops} planning ops /{" "}
                {latest.framework_overhead.planning_ops + latest.framework_overhead.source_ops} total — score{" "}
                <strong className="text-foreground">{latest.framework_overhead.score}</strong>
              </p>
            </div>
          </div>
        )}
      </SiteSection>

      {/* Loop compliance */}
      <SiteSection tone="muted" className="border-t border-border/60">
        <SiteSectionHeading kicker="Loop compliance" title="How often do sessions actually follow the GAD loop?" />
        <SiteProse className="mt-5 max-w-4xl">
          The canonical GAD loop (<Ref id="gad-18" />) says: start with <code className="rounded bg-card/60 px-1 text-accent">gad snapshot</code>
          , pick one task, implement, update planning docs, commit. Loop compliance measures the fraction of
          sessions that actually start with a snapshot call — the cheapest proxy for "did the agent follow the loop."
        </SiteProse>

        <div className="mt-6 space-y-4">
          <Formula>
            loop_compliance = sessions_starting_with_snapshot / total_sessions
          </Formula>
        </div>

        {latest && (
          <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current snapshot</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-4">
              <p className="text-4xl font-semibold tabular-nums text-foreground">
                {(latest.loop_compliance.score * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground">
                {latest.loop_compliance.snapshot_starts} of {latest.loop_compliance.total_sessions} sessions
              </p>
            </div>
          </div>
        )}
      </SiteSection>

      {/* Sources */}
      <SiteSection className="border-t border-border/60">
        <SiteSectionHeading kicker="Data sources" title="Where the numbers come from" />
        <SiteProse className="mt-5 max-w-4xl">
          All formulas run during the site prebuild (<code className="rounded bg-card/60 px-1 text-accent">site/scripts/compute-self-eval.mjs</code>)
          against these inputs:
        </SiteProse>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <code className="text-xs font-mono text-accent">.planning/TASK-REGISTRY.xml</code>
              <p className="mt-1 text-xs text-muted-foreground">Tasks per phase — feeds pressure</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <code className="text-xs font-mono text-accent">.planning/ROADMAP.xml</code>
              <p className="mt-1 text-xs text-muted-foreground">Phase titles + statuses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <code className="text-xs font-mono text-accent">.planning/DECISIONS.xml</code>
              <p className="mt-1 text-xs text-muted-foreground">Decision count</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <code className="text-xs font-mono text-accent">.planning/.gad-log/*.jsonl</code>
              <p className="mt-1 text-xs text-muted-foreground">Tool call traces — feeds overhead + loop compliance</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <code className="text-xs font-mono text-accent">site/data/self-eval-config.json</code>
              <p className="mt-1 text-xs text-muted-foreground">All tunable weights + thresholds</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <code className="text-xs font-mono text-accent">site/data/self-eval.json</code>
              <p className="mt-1 text-xs text-muted-foreground">Output — append-only snapshots over time</p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Related decisions: <Ref id="gad-75" />, <Ref id="gad-79" />, <Ref id="gad-95" />,{" "}
          <Ref id="gad-103" />, <Ref id="gad-115" />, <Ref id="gad-144" />, <Ref id="gad-145" />
        </p>
      </SiteSection>

      <Footer />
    </main>
  );
}
