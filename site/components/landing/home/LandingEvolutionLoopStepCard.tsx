import { ArrowRight, type LucideIcon } from "lucide-react";
import { Identified } from "@portfolio/visual-context";

export type LoopStep = {
  key: string;
  kicker: string;
  title: string;
  blurb: string;
  artifact: string;
  icon: LucideIcon;
  command?: string;
};

/**
 * Single step card in the evolution loop (detect → candidate → draft →
 * install → shed). Renders a connector arrow between cards on `lg:` so the
 * five-column grid reads as a sequence. `Identified` per-step gives each
 * card a distinct grep target (`LandingEvolutionLoopStep-<key>`); the
 * enclosing grid wrapper names the whole strip.
 */
export function LandingEvolutionLoopStepCard({
  step,
  index,
  total,
}: {
  step: LoopStep;
  index: number;
  total: number;
}) {
  const Icon = step.icon;
  const isLast = index === total - 1;
  return (
    <Identified
      as={`LandingEvolutionLoopStep-${step.key}`}
      className="relative flex min-w-0 flex-col"
    >
      <div className="flex min-h-full flex-col rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
            <Icon size={16} aria-hidden />
          </span>
          <p className="section-kicker !mb-0">{step.kicker}</p>
        </div>
        <p className="mt-3 text-sm font-semibold leading-snug text-foreground">{step.title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.blurb}</p>
        <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
          <p className="font-mono text-[11px] text-muted-foreground/90">
            <span className="mr-1 text-muted-foreground/60">artifact</span>
            <span className="text-foreground/85">{step.artifact}</span>
          </p>
          {step.command ? (
            <p className="font-mono text-[11px] text-accent/90">
              <span className="mr-1 text-muted-foreground/60">command</span>
              {step.command}
            </p>
          ) : null}
        </div>
      </div>
      {!isLast ? (
        <ArrowRight
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-[-0.7rem] top-1/2 hidden -translate-y-1/2 text-accent/50 lg:block"
        />
      ) : null}
    </Identified>
  );
}
