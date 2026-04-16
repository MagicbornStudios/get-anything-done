import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionIntro } from "@/components/site";
import { cn } from "@/lib/utils";
import { EvolutionVeinBackdrop } from "./EvolutionVeinBackdrop";

function EvolutionSectionBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/8" />
      <EvolutionVeinBackdrop />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-background/50" />
    </div>
  );
}

/**
 * Home hero: `SiteSection` mounts the section dev panel; `Identified as="LandingEvolutionBand"`
 * is the inner grep target. `id="top"` preserves `/#top`. `cid="evolution-site-section"` is the
 * source-search literal for visual-context handoff.
 */
export function LandingEvolutionBand() {
  return (
    <SiteSection
      id="top"
      cid="evolution-site-section"
      tone="muted"
      beforeShell={<EvolutionSectionBackdrop />}
      shellClassName="relative z-10"
      className={cn(
        "relative overflow-hidden border-t border-border/60",
        "bg-background/35 backdrop-blur-[2px]",
      )}
    >
      <Identified as="LandingEvolutionBand">
        <SiteSectionIntro
          kicker="Site hero · Evolution"
          preset="hero"
          as="h1"
          title={
            <>
              Get anything done:{" "}
              <span className="gradient-text">context under pressure.</span>
            </>
          }
          proseSize="md"
          proseClassName="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          GAD is a context system: uncertainty in a phase (Shannon entropy) signals where new skills
          should form. Pressure comes from the work itself — then candidates, review, and promotion
          into permanent roto skills for your workflow.
        </SiteSectionIntro>

        <div className="mt-12">
          <Identified as="LandingEvolutionShannonFormula">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm">
              <p className="section-kicker !mb-2">Shannon entropy</p>
              <p className="font-mono text-sm leading-relaxed text-foreground md:text-base">
                H(X) = −<span className="whitespace-nowrap">∑</span>
                <sub className="text-xs">x</sub> p(x) log
                <sub className="text-xs">2</sub> p(x)
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Maximum when outcomes are evenly uncertain; drops to zero when you already know the
                answer. We borrow the same lens for “where is the phase still ambiguous?”
              </p>
            </div>
          </Identified>
        </div>

      </Identified>
    </SiteSection>
  );
}
