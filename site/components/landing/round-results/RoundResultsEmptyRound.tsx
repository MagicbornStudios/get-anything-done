type Props = {
  roundLabel: string;
};

export function RoundResultsEmptyRound({ roundLabel }: Props) {
  return (
    <div className="mt-12 rounded-2xl border border-border/70 bg-card/30 p-8 text-center">
      <p className="text-lg font-semibold text-muted-foreground">No scored runs for {roundLabel}</p>
      <p className="mt-2 text-sm text-muted-foreground/70">
        This round may not have scored builds yet, or all runs were interrupted.
      </p>
    </div>
  );
}
