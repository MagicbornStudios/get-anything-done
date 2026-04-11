import { Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ROUND_RESULTS_DEFAULT_HEADLINE,
  ROUND_SELECT_OPTIONS,
  ROUNDS_HEADLINE_MAP,
  type RoundHeadlineData,
} from "@/components/landing/round-results/round-results-shared";
import { RoundHeadline } from "@/components/landing/round-results/RoundHeadline";

type Props = {
  effectiveRound: string | null;
  localRoundFilter: string | null;
  globalRoundFilter: string | null;
  onLocalRoundChange: (round: string | null) => void;
};

export function RoundResultsHeader({
  effectiveRound,
  localRoundFilter,
  globalRoundFilter,
  onLocalRoundChange,
}: Props) {
  const headline: RoundHeadlineData = effectiveRound
    ? ROUNDS_HEADLINE_MAP[effectiveRound] ?? ROUND_RESULTS_DEFAULT_HEADLINE
    : ROUND_RESULTS_DEFAULT_HEADLINE;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="section-kicker">{headline.kicker}</p>
        <div className="ml-auto">
          <Select
            value={localRoundFilter ?? "all"}
            onValueChange={(v) => onLocalRoundChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All rounds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rounds</SelectItem>
              {ROUND_SELECT_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {effectiveRound && (
          <button
            type="button"
            onClick={() => onLocalRoundChange(null)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <X size={10} aria-hidden />
            Show all
          </button>
        )}
      </div>

      <h2 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        <RoundHeadline data={headline} />
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{headline.description}</p>

      {globalRoundFilter && !localRoundFilter && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
          <Filter size={10} aria-hidden />
          Filtered to {globalRoundFilter} from chart
        </div>
      )}
    </>
  );
}
