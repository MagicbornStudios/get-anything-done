import { Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EVAL_PROJECTS } from "@/lib/eval-data";

export function MethodologyCompositeSection() {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-2 flex items-center gap-2">
          <Calculator size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Composite formula</p>
        </div>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">The weighted sum</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          The composite score is a plain weighted sum of dimension scores. Every dimension is
          normalised to 0.0 – 1.0 before the multiply. The weights are project-specific and committed
          to{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">
            evals/&lt;project&gt;/gad.json
          </code>
          .
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-6 md:p-8">
          <p className="font-mono text-sm text-muted-foreground">composite =</p>
          <p className="mt-2 font-mono text-base leading-8 text-foreground">
            Σ<sub>dimensions</sub>
            <span className="mx-2">(</span>
            <span className="text-accent">
              score<sub>i</sub>
            </span>
            <span className="mx-2">×</span>
            <span className="text-emerald-400">
              weight<sub>i</sub>
            </span>
            <span className="mx-2">)</span>
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Weights sum to 1.0 across a project&apos;s dimensions. A run can max out at 1.0; the
            minimum is 0.0 (modulo the low-score cap below).
          </p>
        </div>

        <h3 className="mt-14 text-2xl font-semibold tracking-tight">Weights per eval project</h3>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Different eval projects weight different dimensions. A tooling eval might care most about
          time efficiency; an implementation eval weighs human review at 30% to prevent process
          metrics from rescuing a broken artifact.
        </p>

        <div className="mt-6 space-y-5">
          {EVAL_PROJECTS.filter((p) => p.scoringWeights && p.workflow).map((p) => {
            const entries = Object.entries(p.scoringWeights ?? {}).sort((a, b) => b[1] - a[1]);
            const total = entries.reduce((acc, [, w]) => acc + w, 0);
            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl border border-border/70 bg-card/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/30 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.id}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.evalMode} · {p.workflow}
                    </p>
                  </div>
                  <Badge variant="outline">Σ weights = {total.toFixed(2)}</Badge>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {entries.map(([dim, w], idx) => (
                      <tr
                        key={dim}
                        className={idx % 2 === 0 ? "bg-transparent" : "bg-background/20"}
                      >
                        <td className="px-5 py-2.5 font-mono text-[11px] text-foreground">{dim}</td>
                        <td className="px-5 py-2.5 tabular-nums text-accent">{w.toFixed(2)}</td>
                        <td className="px-5 py-2.5">
                          <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-accent/80"
                              style={{ width: `${w * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
