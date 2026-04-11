type Props = {
  activeRound: string;
  onClear: () => void;
};

export function HypothesisTracksActiveRoundBar({ activeRound, onClear }: Props) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-300">
        Filtering: {activeRound}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
      >
        Clear filter
      </button>
    </div>
  );
}
