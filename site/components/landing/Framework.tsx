import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WORKFLOW_DESCRIPTIONS, WORKFLOW_LABELS, type Workflow } from "@/lib/eval-data";

const SCORE_WEIGHTS: Array<{ key: string; label: string; weight: number; gist: string }> = [
  { key: "human_review", label: "Human review", weight: 0.3, gist: "Subjective quality vote — gates everything." },
  { key: "requirement_coverage", label: "Requirement coverage", weight: 0.15, gist: "How many gate criteria the artifact passes." },
  { key: "planning_quality", label: "Planning quality", weight: 0.15, gist: "Phases, tasks, and decisions actually captured." },
  { key: "per_task_discipline", label: "Per-task discipline", weight: 0.15, gist: "Atomic commits with task IDs vs batch dumps." },
  { key: "skill_accuracy", label: "Skill accuracy", weight: 0.10, gist: "Did the agent invoke skills when their triggers fired?" },
  { key: "time_efficiency", label: "Time efficiency", weight: 0.05, gist: "Wall-clock vs the project's expected envelope." },
];

const ORDER: Workflow[] = ["gad", "bare", "emergent"];

export default function Framework() {
  return (
    <section id="framework" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">The eval framework</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Three workflows. <span className="gradient-text">One scoring formula.</span> No hiding behind process metrics.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Each eval project ships a <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">REQUIREMENTS.xml</code>{" "}
          with versioned gate criteria. Every run produces a <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code>{" "}
          with a composite score. Process metrics matter, but they cannot rescue a run that ships
          a broken game — human review weighs 30% precisely so &quot;the process was followed&quot;
          isn&apos;t a free pass.
        </p>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {ORDER.map((wf) => (
            <Card key={wf} className="flex h-full flex-col">
              <CardHeader>
                <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                  Workflow
                </div>
                <CardTitle className="text-2xl">{WORKFLOW_LABELS[wf]}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="text-base leading-7">
                  {WORKFLOW_DESCRIPTIONS[wf]}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14">
          <h3 className="text-2xl font-semibold tracking-tight">Composite score weights</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Defined in <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">evals/&lt;project&gt;/gad.json</code>.
            Same formula across every implementation eval, so you can compare a GAD run to a Bare run apples-to-apples.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Dimension</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Weight</th>
                  <th className="px-5 py-3 font-medium">What it measures</th>
                </tr>
              </thead>
              <tbody>
                {SCORE_WEIGHTS.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{row.label}</td>
                    <td className="px-5 py-3 tabular-nums text-accent">{row.weight.toFixed(2)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.gist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
