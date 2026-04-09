import Link from "next/link";
import { ArrowRight, ClipboardList, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { EVAL_PROJECTS, WORKFLOW_LABELS, type Workflow } from "@/lib/eval-data";

export const metadata = {
  title: "Human review rubric — GAD",
  description:
    "The scored dimensions a human reviewer uses when playing an eval run. Per-project weights, per-dimension descriptions, and the CLI command to submit a review.",
};

const WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  bare: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  emergent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

function buildRubricExampleJson(
  dimensions: Array<{ key: string; weight: number }>
): string {
  const parts = dimensions.map((d) => `"${d.key}": 0.80`);
  return `{${parts.join(", ")}}`;
}

export default function RubricPage() {
  const projectsWithRubric = EVAL_PROJECTS.filter(
    (p) => p.humanReviewRubric && p.humanReviewRubric.dimensions.length > 0
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Human review rubric</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            How we score a playthrough.{" "}
            <span className="gradient-text">Per-dimension, not a single number.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Every eval run gets human playtested. A single summary score is lossy, so we
            decompose review into per-project rubrics: a handful of named dimensions, each
            scored 0.0 – 1.0, each with a fixed weight. The weighted sum becomes the{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-sm">human_review.score</code>{" "}
            the composite formula consumes. The emergent workflow gets a sixth dimension that
            specifically tests the{" "}
            <Link href="/findings" className="text-accent underline decoration-dotted">
              compound-skills hypothesis
            </Link>
            .
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Source of truth: the{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">human_review_rubric</code>{" "}
            block on each project&apos;s{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad.json</code>. Rubric
            version is stamped on every submitted review so historical scores remain
            comparable when dimensions change.
          </p>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-2">
            <ClipboardList size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">How to read the weights</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dimensions sum to 1.0</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Weights across a project are normalized to 1.0 so the weighted sum is always
                in [0.0, 1.0]. A dimension with weight 0.30 contributes three times as much to
                the aggregate as one with weight 0.10.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Every dimension 0.0 – 1.0</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Score each dimension independently. A total game-loop softlock tanks
                playability to ~0.10 without forcing you to punish UI polish or mechanics
                scores. Precision is ~0.05 — don&apos;t agonize over 0.82 vs 0.83.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Partial rubrics are allowed</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                If you genuinely can&apos;t score a dimension (e.g. you couldn&apos;t reach a
                feature), leave it out of the submitted JSON — the aggregate is computed over
                the dimensions you did provide, with a note recorded on the run.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {projectsWithRubric.map((project) => {
        const rubric = project.humanReviewRubric!;
        const workflow = (project.workflow ?? "gad") as Workflow;
        const totalWeight = rubric.dimensions.reduce((acc, d) => acc + d.weight, 0);
        const exampleJson = buildRubricExampleJson(rubric.dimensions);

        return (
          <section
            key={project.id}
            id={project.id}
            className="border-b border-border/60"
          >
            <div className="section-shell">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${WORKFLOW_TINT[workflow]}`}
                >
                  {WORKFLOW_LABELS[workflow]}
                </span>
                <Badge variant="outline">rubric {rubric.version}</Badge>
                <Badge variant="outline">
                  {rubric.dimensions.length} dimensions · Σ {totalWeight.toFixed(2)}
                </Badge>
              </div>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                {project.name}
              </h2>
              {project.description && (
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                  {project.description}
                </p>
              )}

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {rubric.dimensions.map((dim) => {
                  const pct = Math.round(dim.weight * 100);
                  return (
                    <Card key={dim.key}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-base leading-tight">
                            {dim.label}
                          </CardTitle>
                          <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent">
                            {dim.weight.toFixed(2)}
                          </span>
                        </div>
                        <code className="block text-[11px] text-muted-foreground">
                          {dim.key}
                        </code>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-card/60">
                          <div
                            className="h-full rounded-full bg-accent/80"
                            style={{ width: `${pct}%` }}
                            aria-hidden
                          />
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {dim.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-8 rounded-2xl border border-border/70 bg-card/40 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Terminal size={14} className="text-accent" aria-hidden />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Submit a review
                  </p>
                </div>
                <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-6 text-muted-foreground">
                  {`gad eval review ${project.id} v<N> \\
  --rubric '${exampleJson}' \\
  --notes "what landed, what broke, what surprised you"`}
                </pre>
                <p className="mt-3 text-xs text-muted-foreground">
                  Replace each <code className="rounded bg-background/60 px-1 py-0.5">0.80</code>{" "}
                  with your real score. The CLI computes the weighted aggregate and writes it
                  to that run&apos;s <code className="rounded bg-background/60 px-1 py-0.5">TRACE.json</code>.
                </p>
                <Link
                  href={`/projects/${project.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  See every run for this project
                  <ArrowRight size={11} aria-hidden />
                </Link>
              </div>
            </div>
          </section>
        );
      })}

      {projectsWithRubric.length === 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="text-muted-foreground">
              No projects have a human review rubric defined yet. Add a{" "}
              <code>human_review_rubric</code> block to a project&apos;s{" "}
              <code>gad.json</code> and regenerate site data.
            </p>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
