import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVAL_RUNS, WORKFLOW_LABELS, type Workflow } from "@/lib/eval-data";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";
const WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "border-l-sky-400/70",
  bare: "border-l-emerald-400/70",
  emergent: "border-l-amber-400/70",
};

function ScoreBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-accent/80"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function Results() {
  return (
    <section id="results" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Round 3 results</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          The freedom hypothesis: <span className="gradient-text">bare beat GAD</span> on creative implementation.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          We ran the same task — &quot;build a roguelike dungeon crawler called Escape the Dungeon&quot; —
          across all three workflows, three rounds in a row, with the same v3 requirements.
          Across every metric the human reviewers cared about, the bare and emergent workflows
          shipped better games than the full GAD framework. That wasn&apos;t the result we expected
          and it sent us back to redesign v4 of the requirements around <em>pressure</em>, not features.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {EVAL_RUNS.map((run) => (
            <Card
              key={`${run.project}-${run.version}`}
              className={`border-l-4 ${WORKFLOW_TINT[run.workflow]} transition-colors hover:border-accent/70`}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className="border-border/70">
                    {WORKFLOW_LABELS[run.workflow]} · {run.version}
                  </Badge>
                  {run.gateFailed ? (
                    <Badge variant="danger">Gate failed</Badge>
                  ) : (
                    <Badge variant="success">Gate passed</Badge>
                  )}
                </div>
                <CardTitle className="mt-2 truncate text-lg">{run.project}</CardTitle>
                <CardDescription>requirements {run.requirementsVersion} · {run.date}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>Composite</span>
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {run.composite.toFixed(3)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ScoreBar value={run.composite} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>Human review</span>
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {run.humanReview.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ScoreBar value={run.humanReview} />
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{run.notes}</p>
                <a
                  href={`${REPO}/tree/main/evals/${run.project}/${run.version}`}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  TRACE.json on GitHub
                  <ExternalLink size={12} aria-hidden />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
          <p className="section-kicker">What we changed for round 4</p>
          <h3 className="mt-1 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
            Pressure, not features. Ingenuity, not checklists.
          </h3>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            v4 of the requirements stops asking the agent to build a list of systems and starts
            asking whether the resulting game <em>requires</em> player ingenuity to progress.
            Authored dungeon, floors with mechanical constraints that punish brute-force play, a
            forge that&apos;s tied to the encounter design instead of being a side ornament. The
            same three workflows will run round 4 against v4 to test whether the freedom hypothesis
            holds when the spec is harder to game.
          </p>
        </div>
      </div>
    </section>
  );
}
