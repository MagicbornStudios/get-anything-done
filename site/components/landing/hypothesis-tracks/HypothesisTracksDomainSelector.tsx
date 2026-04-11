import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVAL_DOMAINS } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";

type Props = {
  selectedDomain: string;
  onSelectDomain: (domainId: string) => void;
};

export function HypothesisTracksDomainSelector({ selectedDomain, onSelectDomain }: Props) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Domain:
      </span>
      {EVAL_DOMAINS.map((domain) => {
        const selected = selectedDomain === domain.id;
        return (
          <Button
            key={domain.id}
            type="button"
            size="sm"
            variant={selected ? "default" : domain.hasData ? "outline" : "secondary"}
            className={cn(
              "h-9 rounded-full px-3 text-xs font-semibold gap-1.5",
              !domain.hasData && "border-dashed text-muted-foreground/80",
              !selected && domain.hasData && "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
            )}
            onClick={() => onSelectDomain(domain.id)}
          >
            {domain.label}
            {!domain.hasData && <span className="text-[9px] font-normal opacity-60">(planned)</span>}
          </Button>
        );
      })}
    </div>
  );
}
