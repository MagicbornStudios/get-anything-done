import Link from "next/link";
import type { EvalProjectMeta } from "@/lib/eval-data";

export function ProjectScoringWeightsSection({ project }: { project: EvalProjectMeta }) {
  if (!project.scoringWeights) return null;
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Scoring weights</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How this project is scored</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Defined in{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">evals/{project.id}/gad.json</code>
          . The composite score is a weighted sum of these dimensions. See{" "}
          <Link href="/methodology" className="text-accent hover:underline">
            /methodology
          </Link>{" "}
          for the formula and caps.
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Dimension</th>
                <th className="px-5 py-3 font-medium tabular-nums">Weight</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(project.scoringWeights)
                .sort((a, b) => b[1] - a[1])
                .map(([dim, w], idx) => (
                  <tr
                    key={dim}
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                  >
                    <td className="px-5 py-3 font-mono text-xs">{dim}</td>
                    <td className="px-5 py-3 tabular-nums text-accent">{w.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
