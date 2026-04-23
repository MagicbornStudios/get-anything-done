import { Identified } from "@portfolio/visual-context";
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
          kicker="Site hero - Evolution"
          preset="hero"
          as="h1"
          title={
            <>
              Get anything done: <span className="gradient-text">context under pressure.</span>
            </>
          }
          proseSize="md"
          proseClassName="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          GAD is an evolutionary context system: uncertainty in a phase (Shannon entropy) signals
          where new skills should form. Pressure comes from the work itself — species mutate,
          generations compete, and the survivors promote into permanent proto-skills for your
          workflow.
        </SiteSectionIntro>

        <div className="mt-12">
          <Identified as="LandingEvolutionShannonFormula">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm md:p-8">
              <div className="grid gap-8 md:grid-cols-2 md:gap-10">
                <div>
                  <p className="section-kicker !mb-2">Shannon entropy</p>
                  <p className="font-mono text-base leading-relaxed text-foreground md:text-lg">
                    H(X) = &minus;&sum;<sub className="text-[0.7em]">x</sub>{" "}
                    p(x) log<sub className="text-[0.7em]">2</sub> p(x)
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Maximum when outcomes are evenly uncertain, zero when you already know the
                    answer. We borrow the lens to ask:{" "}
                    <em className="text-foreground/80">where is this phase still ambiguous?</em>
                  </p>
                </div>

                <div>
                  <p className="section-kicker !mb-2">
                    Phase pressure{" "}
                    <span className="ml-1 rounded-full border border-border/60 bg-background/60 px-1.5 py-0.5 align-middle text-[0.65rem] font-normal uppercase tracking-wide text-muted-foreground">
                      v3 &middot; gad-222
                    </span>
                  </p>
                  <p className="font-mono text-base leading-snug text-foreground md:text-lg">
                    P = T + C<sub className="text-[0.7em]">a</sub>w<sub className="text-[0.7em]">c</sub>{" "}
                    + C<sub className="text-[0.7em]">l</sub>w<sub className="text-[0.7em]">l</sub>{" "}
                    + D&middot;w<sub className="text-[0.7em]">d</sub>{" "}
                    + (D/T)&middot;w<sub className="text-[0.7em]">r</sub>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Every phase carries resolved entropy, latent entropy, and raw volume.{" "}
                    <em className="text-foreground/80">Latent</em> crosscuts (no decision yet) weigh
                    heavier than <em className="text-foreground/80">anticipated</em> ones — the
                    unknown unknowns are where new skills are born.
                  </p>
                </div>
              </div>

              <dl className="mt-8 grid gap-x-6 gap-y-2 border-t border-border/40 pt-6 text-xs leading-snug text-muted-foreground sm:grid-cols-2 md:text-[0.8rem]">
                <div className="flex gap-2">
                  <dt className="font-mono font-medium text-foreground/85">T</dt>
                  <dd>tasks in the phase (implementation volume)</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-mono font-medium text-foreground/85">D</dt>
                  <dd>decisions recorded (resolved entropy)</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-mono font-medium text-foreground/85">
                    C<sub>a</sub>
                  </dt>
                  <dd>
                    anticipated crosscuts &mdash; cross-system tasks paired with a decision
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-mono font-medium text-foreground/85">
                    C<sub>l</sub>
                  </dt>
                  <dd>
                    latent crosscuts &mdash; cross-system work nobody knew to ask about
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-mono font-medium text-foreground/85">
                    w<sub>c</sub>, w<sub>l</sub>
                  </dt>
                  <dd>
                    crosscut weights (default 2&times; anticipated, 4&times; latent)
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-mono font-medium text-foreground/85">
                    w<sub>d</sub>, w<sub>r</sub>
                  </dt>
                  <dd>
                    decision weight and D/T ratio weight (direction density)
                  </dd>
                </div>
              </dl>

              <p className="mt-6 border-l-2 border-accent/50 pl-4 text-sm italic leading-relaxed text-foreground/85">
                Where there is pressure, there is growth. High-pressure phases with low decision
                density are the ones that reliably produce new proto-skills.
              </p>
            </div>
          </Identified>
        </div>
      </Identified>
    </SiteSection>
  );
}