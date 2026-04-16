import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteProse } from "@/components/site";

/**
 * Home band: evolution as try / keep / shed, proto-skills from the mess, Claude Code graphify quote,
 * Sun Tzu epigraph. `cid="graphify-eyeball-site-section"` for VC handoff.
 */
export function LandingGraphifyEyeballBand() {
  return (
    <SiteSection id="eyeball-chaos" cid="graphify-eyeball-site-section" className="border-t border-border/60">
      <Identified as="LandingGraphifyEyeballBand">
        <Identified as="LandingGraphifyRecommend" className="block">
          <p className="section-kicker">Try, learn, shed</p>
          <figure className="mt-3 max-w-3xl">
            <blockquote className="rounded-xl border border-border/60 bg-muted/15 px-5 py-4 text-base font-normal leading-relaxed text-foreground/90 md:text-lg [&>p]:m-0">
              <p>
                &ldquo;Run{" "}
                <code className="whitespace-nowrap rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  gad try graphify
                </code>{" "}
                on{" "}
                <code className="rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  .planning/
                </code>
                ,{" "}
                <code className="rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  skills/
                </code>
                , and{" "}
                <code className="rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  DECISIONS.xml
                </code>
                . Squint at the graph. Then decide.&rdquo;
              </p>
            </blockquote>
            <figcaption className="mt-3 border-l-2 border-accent/40 pl-4 text-sm text-muted-foreground">
              <span className="text-foreground/80">— Claude Code</span>
              <span className="text-muted-foreground/90"> (session recommendation)</span>
            </figcaption>
          </figure>
        </Identified>

        <Identified as="LandingProtoSkillEyeballNarrative" className="mt-6 block">
          <SiteProse size="lg" className="max-w-3xl text-muted-foreground">
            <strong className="font-medium text-foreground">Evolution</strong> means trying things
            in the open, keeping what works, and{" "}
            <strong className="font-medium text-foreground">shedding</strong> the rest — good enough
            now beats a perfect plan you never ship; you can always improve later.{" "}
            <strong className="font-medium text-foreground">Get Anything Done</strong> is built for
            that: skills grow out of real attempts, chaos included. The{" "}
            <strong className="font-medium text-foreground">visual context system</strong> began as
            exactly that kind of experiment.
          </SiteProse>
        </Identified>

        <Identified as="LandingArtOfWarChaosQuote" className="mt-8 block">
          <figure className="max-w-2xl">
            <blockquote className="rounded-xl border border-border/60 bg-muted/15 px-5 py-4 text-base font-normal italic leading-relaxed text-muted-foreground md:text-lg [&>p]:m-0">
              <p>
                &ldquo;In the midst of chaos, there is also opportunity.&rdquo;
              </p>
            </blockquote>
            <figcaption className="mt-3 border-l-2 border-accent/40 pl-4 text-sm text-muted-foreground">
              <span className="text-foreground/80">— Sun Tzu,</span>{" "}
              <cite className="font-normal not-italic text-foreground/70">The Art of War</cite>
              <span className="text-muted-foreground/90"> (common English rendering)</span>
            </figcaption>
          </figure>
          <p className="mt-5 max-w-3xl text-sm font-medium text-foreground/90">
            Still you with eyeballs — the graph just makes the chaos legible.
          </p>
        </Identified>
      </Identified>
    </SiteSection>
  );
}
