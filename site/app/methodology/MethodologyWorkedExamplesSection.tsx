import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

export function MethodologyWorkedExamplesSection({ worked }: { worked: EvalRunRecord[] }) {
  if (worked.length === 0) return null;
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Worked examples</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Two runs, end to end</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Two runs picked as walkthroughs — one process-vs-reality divergence, one highest-scoring
          bare run. Click through for the full per-run view with the formula breakdown.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {worked.map((run) => (
            <Card key={`${run.project}-${run.version}`}>
              <CardHeader>
                <CardTitle className="text-base">
                  {run.project} · {run.version}
                </CardTitle>
                <CardDescription>
                  composite {run.scores.composite?.toFixed(3) ?? "—"} · human{" "}
                  {run.humanReview?.score?.toFixed(2) ?? "—"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-6 text-muted-foreground line-clamp-4">
                  {run.humanReview?.notes ?? run.requirementCoverage?.gate_notes ?? ""}
                </p>
                <Link
                  href={`/runs/${run.project}/${run.version}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                >
                  Full breakdown →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
