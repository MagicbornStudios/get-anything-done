import { RunScoreBar } from "@/components/run-detail/RunScoreBar";
import { formatNum } from "@/lib/run-detail-shared";

type RunHeroScoresBlockProps = {
  composite: number;
  humanScore: number | null;
};

export function RunHeroScoresBlock({ composite, humanScore }: RunHeroScoresBlockProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Composite score</p>
        <p className="mt-1 text-6xl font-semibold tabular-nums gradient-text">{formatNum(composite)}</p>
        <div className="mt-3">
          <RunScoreBar value={composite} />
        </div>
      </div>
      {humanScore != null && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Human review</p>
          <p
            className={`mt-1 text-6xl font-semibold tabular-nums ${
              humanScore >= 0.5 ? "text-emerald-400" : humanScore >= 0.25 ? "text-amber-400" : "text-red-400"
            }`}
          >
            {humanScore.toFixed(2)}
          </p>
          <div className="mt-3">
            <RunScoreBar value={humanScore} />
          </div>
        </div>
      )}
    </div>
  );
}
