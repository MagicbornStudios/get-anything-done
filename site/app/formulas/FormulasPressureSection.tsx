import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import { SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";
import selfEvalConfig from "@/data/self-eval-config.json";
import { FormulasFormula } from "./FormulasFormula";

const pressureCfg = selfEvalConfig.pressure;
const crosscutCfg = selfEvalConfig.crosscut_detection;

export function FormulasPressureSection() {
  return (
    <SiteSection cid="formulas-pressure-section-site-section" tone="muted" className="border-t border-border/60">
      <SiteSectionHeading kicker="Phase pressure" title="How hard was this phase, really?" />
      <SiteProse className="mt-5 max-w-4xl">
        Pressure is a Shannon-inspired approximation of the total information burden a phase imposed on whoever worked it. It combines <strong>raw task count</strong> (entropy H — the bits needed to describe the phase&apos;s workload) with <strong>crosscut count</strong> (mutual information I(X;Y) — tasks that span multiple subsystems, carrying information about both). Weighted sum approximates the agent&apos;s mental state requirement.
      </SiteProse>

      <div className="mt-6 space-y-4">
        <FormulasFormula>pressure = tasks_total + (crosscuts × crosscut_weight)</FormulasFormula>
        <FormulasFormula>high_pressure = pressure &gt; high_pressure_threshold</FormulasFormula>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              crosscut_weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{pressureCfg.crosscut_weight}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Multiplier applied to crosscut count. Crosscuts are weighted heavily because cross-cutting work requires
              holding multiple system contexts simultaneously, roughly doubling the mental state an agent must hold.
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
            <p className="text-3xl font-semibold tabular-nums text-foreground">{pressureCfg.high_pressure_threshold}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Phases with pressure above this threshold are flagged as high-pressure and become skill candidate sources.
              Tuning this controls how many phases get drafted as candidates.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">systems tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{crosscutCfg.systems.length}</p>
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
          This is an intentional nod to Claude Shannon&apos;s information theory. In the Shannon framing:
        </p>
        <ul className="mt-3 max-w-3xl space-y-2 text-sm leading-6 text-muted-foreground">
          <li>
            <strong className="text-foreground">
              tasks_total &approx; H
            </strong>{" "}
            — raw entropy of the phase. Each task is an independent unit of work that adds uncertainty about
            &quot;what needs to happen&quot; until it&apos;s resolved. A phase with 50 tasks has more H than a phase
            with 5.
          </li>
          <li>
            <strong className="text-foreground">
              crosscuts &approx; I(X;Y)
            </strong>{" "}
            — mutual information between subsystems. When a task&apos;s goal mentions multiple subsystems (say{" "}
            <code className="text-accent">cli</code> + <code className="text-accent">site</code>), that task carries
            shared information about both. It can&apos;t be finished without understanding both. Crosscuts measure how
            entangled a phase is.
          </li>
          <li>
            <strong className="text-foreground">
              pressure &approx; total information burden
            </strong>{" "}
            — the weighted sum approximates how much state the agent had to hold to get through the phase. High pressure
            is a signal that patterns exist worth capturing as reusable skills (<Ref id="gad-115" />).
          </li>
        </ul>
        <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
          Caveat: this is an <em>approximation</em>, not formal information theory. Real entropy requires a probability
          distribution over task states; we use a proxy based on task counts and keyword-derived crosscuts. The goal is
          a useful signal that scales monotonically with complexity, not rigor.
        </p>
      </div>
    </SiteSection>
  );
}

