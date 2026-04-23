import { Identified } from "@portfolio/visual-context";
import { SiteSection } from "@/components/site";

/**
 * Home band: Claude Code graphify quote + Sun Tzu epigraph.
 * `cid="graphify-eyeball-site-section"` preserved for VC handoff (grep + dev panel).
 */
export function LandingGraphifyChaosBand() {
  return (
    <SiteSection
      id="graph-chaos-opportunity"
      cid="graphify-eyeball-site-section"
      className="border-t border-border/60 bg-gradient-to-b from-background via-muted/[0.04] to-background"
    >
      <Identified as="LandingGraphifyChaosBand">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-stretch lg:gap-12">
          <Identified as="LandingGraphifyRecommend" className="flex flex-col">
            <p className="section-kicker">Try, learn, shed</p>
            <figure className="mt-4 flex flex-1 flex-col">
              <blockquote className="flex flex-1 flex-col justify-center rounded-2xl border border-border/50 bg-card/40 px-6 py-6 text-base font-normal leading-relaxed text-foreground/90 shadow-sm ring-1 ring-border/30 backdrop-blur-sm md:px-7 md:py-7 md:text-lg [&>p]:m-0">
                <p>
                  &ldquo;Run{" "}
                  <code className="whitespace-nowrap rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                    gad try graphify
                  </code>{" "}
                  on{" "}
                  <code className="rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                    .planning/
                  </code>
                  ,{" "}
                  <code className="rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                    skills/
                  </code>
                  , and{" "}
                  <code className="rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                    DECISIONS.xml
                  </code>
                  . Squint at the graph. Then decide.&rdquo;
                </p>
              </blockquote>
              <figcaption className="mt-4 border-l-2 border-accent/50 pl-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/85">— Claude Code</span>
                <span className="text-muted-foreground/90"> (session recommendation)</span>
              </figcaption>
            </figure>
          </Identified>

          <Identified as="LandingArtOfWarChaosQuote" className="flex flex-col">
            <p className="section-kicker">Opportunity</p>
            <figure className="mt-4 flex flex-1 flex-col">
              <div className="flex flex-1 flex-col justify-center rounded-2xl border border-accent/20 bg-gradient-to-br from-muted/25 via-card/30 to-background p-1 shadow-md ring-1 ring-border/40">
                <blockquote className="rounded-[calc(1rem-2px)] border border-border/40 bg-background/60 px-6 py-6 text-base font-normal italic leading-relaxed text-muted-foreground md:px-7 md:py-7 md:text-lg [&>p]:m-0">
                  <p>&ldquo;In the midst of chaos, there is also opportunity.&rdquo;</p>
                </blockquote>
              </div>
              <figcaption className="mt-4 border-l-2 border-accent/50 pl-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/85">— Sun Tzu,</span>{" "}
                <cite className="font-normal not-italic text-foreground/75">The Art of War</cite>
                <span className="text-muted-foreground/90"> (common English rendering)</span>
              </figcaption>
              <p className="mt-5 max-w-xl text-sm font-medium leading-relaxed text-foreground/90 md:text-[0.95rem]">
                Grab the graph first: it does not shrink the storm, but it turns noise into edges
                you can name — long enough to see structure and ship a decision that still makes
                sense in the morning.
              </p>
            </figure>
          </Identified>
        </div>
      </Identified>
    </SiteSection>
  );
}
