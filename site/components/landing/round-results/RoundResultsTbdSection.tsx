import { Badge } from "@/components/ui/badge";
import { WORKFLOW_LABELS, type EvalRunRecord } from "@/lib/eval-data";

type Props = {
  runs: EvalRunRecord[];
};

export function RoundResultsTbdSection({ runs }: Props) {
  if (runs.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Awaiting review ({runs.length})
      </h3>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {runs.map((run) => (
          <div
            key={`${run.project}-${run.version}`}
            className="rounded-xl border border-dashed border-border/60 bg-card/20 p-4"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-border/50">
                {WORKFLOW_LABELS[run.workflow]} · {run.version}
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                TBD
              </Badge>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{run.project}</p>
            <p className="text-xs text-muted-foreground">
              requirements {run.requirementsVersion} · {run.date}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
