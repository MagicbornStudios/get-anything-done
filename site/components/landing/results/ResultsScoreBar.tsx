type Props = {
  value: number;
};

export function ResultsScoreBar({ value }: Props) {
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
