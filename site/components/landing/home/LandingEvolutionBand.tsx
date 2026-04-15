import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionIntro } from "@/components/site";
import { cn } from "@/lib/utils";
import { EvolutionVeinBackdrop } from "./EvolutionVeinBackdrop";
import { EvolutionWorkflowFlowSlot } from "./EvolutionWorkflowFlowSlot";

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

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
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

          <Identified as="LandingEvolutionEntropyExample">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm">
              <p className="section-kicker !mb-2">Alice vs Bob (one bit)</p>
              <p className="text-sm text-muted-foreground">
                Prior: Alice and Bob are equally likely →{" "}
                <span className="font-mono text-foreground">H = 1.00 bit</span>.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                    Good question
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    “Are you Alice?”
                  </p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    Yes → Alice · No → Bob · H → 0
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Bad question
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    “Do you like coffee?”
                  </p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    Unrelated to identity · H ≈ 1.00 bit
                  </p>
                </div>
              </div>
            </div>
          </Identified>
        </div>

        <Identified as="LandingEvolutionEntropyInSystem">
          <div className="mt-10 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/8 via-card/30 to-transparent p-6 md:p-8">
            <p className="section-kicker !mb-2">Entropy on the page</p>
            <div className="grid gap-6 md:grid-cols-3 md:gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Uniform prior
                </p>
                <p className="mt-1 font-mono text-lg text-foreground">H = 1.00 bit</p>
                <p className="mt-1 text-xs text-muted-foreground">P(Alice) = P(Bob) = ½</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  After bad split
                </p>
                <p className="mt-1 font-mono text-lg text-foreground">H ≈ 1.00 bit</p>
                <p className="mt-1 text-xs text-muted-foreground">Posterior barely moves</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  After good split
                </p>
                <p className="mt-1 font-mono text-lg text-foreground">H = 0 bit</p>
                <p className="mt-1 text-xs text-muted-foreground">Identity known</p>
              </div>
            </div>
          </div>
        </Identified>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_minmax(0,1.1fr)] lg:items-start">
          <Identified as="LandingEvolutionPressureModel">
            <div className="rounded-2xl border border-border/60 bg-card/30 p-6">
              <p className="section-kicker !mb-2">Pressure → skills</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Pressure</span> rises with how many
                  tasks sit in a phase and how many crosscuts hit that phase — more threads, more
                  unresolved coupling.
                </li>
                <li>
                  High-pressure regions spawn{" "}
                  <span className="font-medium text-foreground">skill candidates</span> — concrete
                  recipes the system might codify.
                </li>
                <li>
                  After <span className="font-medium text-foreground">review</span>, survivors become{" "}
                  <span className="font-medium text-foreground">proto skills</span>, then promoted{" "}
                  <span className="font-medium text-foreground">roto skills</span> locked to your
                  project&apos;s workflow — not anonymous snippets.
                </li>
              </ul>
            </div>
          </Identified>

          <Identified as="LandingEvolutionWorkflowFlow">
            <div>
              <p className="section-kicker !mb-3">Evolutionary workflow</p>
              <EvolutionWorkflowFlowSlot />
            </div>
          </Identified>
        </div>
      </Identified>
    </SiteSection>
  );
}
