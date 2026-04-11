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
      {EVAL_DOMAINS.map((domain) => (
        <button
          key={domain.id}
          type="button"
          onClick={() => onSelectDomain(domain.id)}
          className={[
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            selectedDomain === domain.id
              ? "border-accent bg-accent text-accent-foreground"
              : domain.hasData
                ? "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
                : "border-border/40 bg-card/20 text-muted-foreground/50",
          ].join(" ")}
        >
          {domain.label}
          {!domain.hasData && <span className="text-[9px] opacity-60">(planned)</span>}
        </button>
      ))}
    </div>
  );
}
