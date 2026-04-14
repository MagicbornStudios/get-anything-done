import { Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ROUND_RESULTS_DEFAULT_HEADLINE,
  ROUND_SELECT_OPTIONS,
  ROUNDS_HEADLINE_MAP,
  type RoundHeadlineData,
} from "@/components/landing/round-results/round-results-shared";
import { RoundHeadline } from "@/components/landing/round-results/RoundHeadline";
import { SiteProse, SiteSectionHeading } from "@/components/site";

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
        <p className="section-kicker !mb-0">{headline.kicker}</p>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onLocalRoundChange(null)}
            className="h-auto gap-1 p-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <X size={10} aria-hidden />
            Show all
          </Button>
        )}
      </div>

      <SiteSectionHeading
        preset="hero-compact"
        title={<RoundHeadline data={headline} />}
        className="mt-2"
      />
      <SiteProse className="mt-5">{headline.description}</SiteProse>

      {globalRoundFilter && !localRoundFilter && (
        <Badge
          variant="outline"
          className="mt-4 gap-2 border-purple-500/40 bg-purple-500/10 py-1 pl-2 pr-3 text-xs font-semibold normal-case tracking-normal text-purple-300"
        >
          <Filter size={10} aria-hidden />
          Filtered to {globalRoundFilter} from chart
        </Badge>
      )}
    </>
  );
}

