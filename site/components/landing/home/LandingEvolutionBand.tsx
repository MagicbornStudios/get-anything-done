import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionIntro } from "@/components/site";

/**
 * Same band pattern as Lineage / Playable: `SiteSection` mounts the section dev panel;
 * `Identified as="LandingEvolutionBand"` is the inner grep target. `id="top"` preserves `/#top`.
 */
export function LandingEvolutionBand() {
  return (
    <SiteSection
      id="top"
      cid="evolution-site-section"
      tone="muted"
      className="border-t border-border/60 bg-background/50"
    >
      <Identified as="LandingEvolutionBand">
        <SiteSectionIntro
          kicker="Evolutionary framework"
          preset="hero-compact"
          title={
            <>
              Skills as species: <span className="gradient-text">grow, score, shed.</span>
            </>
          }
        >
          GAD treats methodology content like biology under pressure — generations run against
          requirements, validators score outcomes, and proto skills either graduate or retire
          instead of cluttering the catalog. The loop is deliberate: ship a hypothesis, measure it,
          promote what survives, delete what does not. That is the opposite of endlessly stacking
          &quot;helpful&quot; snippets nobody audits.
        </SiteSectionIntro>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/30 p-6 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Shedding proto skills</p>
            <p className="mt-2">
              Prototypes stay labeled, versioned, and bounded. When a proto skill overlaps a mature
              workflow or fails eval gates, we archive or remove it rather than letting it impersonate
              production guidance. The site and CLI only advertise paths we still trust under
              measurement.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/30 p-6 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Why measurement matters</p>
            <p className="mt-2">
              Evolution without scoring is just churn. Every promoted pattern has to show it survives
              structured tasks, trace capture, and human review — the same bar we use for agent
              comparisons on Escape-the-Dungeon and sibling projects.
            </p>
          </div>
        </div>
      </Identified>
    </SiteSection>
  );
}