import { SCORE_WEIGHTS } from "@/components/landing/framework/framework-shared";

export function FrameworkScoreWeights() {
  return (
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
  );
}
