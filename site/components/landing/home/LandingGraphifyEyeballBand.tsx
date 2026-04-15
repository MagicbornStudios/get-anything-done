import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteProse } from "@/components/site";

/**
 * Home band: how proto-skills and human eyeball passes fit together — graphify recommendation,
 * graduation/shedding metaphor, Sun Tzu epigraph. `cid="graphify-eyeball-site-section"` for VC handoff.
 */
export function LandingGraphifyEyeballBand() {
  return (
    <SiteSection id="eyeball-chaos" cid="graphify-eyeball-site-section" className="border-t border-border/60">
      <Identified as="LandingGraphifyEyeballBand">
        <Identified as="LandingGraphifyRecommend" className="block">
          <p className="section-kicker">Graph first, then judgment</p>
          <figure className="mt-3 max-w-3xl">
            <blockquote className="rounded-xl border border-border/60 bg-muted/15 px-5 py-4 text-base font-normal leading-relaxed text-foreground/90 md:text-lg [&>p]:m-0">
              <p>
                &ldquo;Recommend: run{" "}
                <code className="whitespace-nowrap rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  gad try graphify
                </code>{" "}
                against this repo&apos;s{" "}
                <code className="rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  .planning/
                </code>
                ,{" "}
                <code className="rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  skills/
                </code>
                , and decisions (
                <code className="rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  DECISIONS.xml
                </code>
                ) — eyeball the output, then decide.&rdquo;
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
            That habit is how this repo stays grounded: GAD is built for{" "}
            <strong className="font-medium text-foreground">proto-skills</strong> that appear while
            you work — small, eyeballed workflows that can graduate into canonical skills or shed when
            they overlap something better. The{" "}
            <strong className="font-medium text-foreground">visual context system</strong> itself
            started that way: ship the loop, read it in the UI, promote what survives. Nothing
            replaces your eyes on the artifact; automation proposes, humans dispose.
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
            Everything is an eyeball pass — even the graph. The point is to see structure in the
            noise, then act.
          </p>
        </Identified>
      </Identified>
    </SiteSection>
  );
}
