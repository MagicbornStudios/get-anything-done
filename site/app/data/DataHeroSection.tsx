import { Ref } from "@/components/refs/Ref";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import DataTrustCount from "./DataTrustCount";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export default function DataHeroSection({
  totals,
}: {
  totals: Record<string, number>;
}) {
  return (
    <SiteSection>
      <Identified as="DataHeroHeading">
        <SiteSectionHeading
          kicker="Local DB"
          as="h1"
          preset="hero"
          title={
            <>
              Every number, with a receipt.{" "}
              <span className="gradient-text">Show me where this came from.</span>
            </>
          }
        />
      </Identified>
      <Identified as="DataHeroProsePrimary">
        <SiteProse className="mt-6">
        Research credibility lives or dies on whether you can trace a number back to its inputs. This
        page indexes every chart and stat on the site with: where the number comes from, how it&apos;s
        derived, and whether the source is{" "}
        <strong className="text-emerald-300">deterministic</strong> (computed at prebuild),{" "}
        <strong className="text-rose-300">self-reported</strong> (the agent put it in TRACE.json),{" "}
        <strong>human-rated</strong> (submitted via the rubric CLI), or{" "}
        <strong className="text-muted-foreground">authored</strong> (hand-curated content).
        </SiteProse>
      </Identified>
      <Identified as="DataHeroProseGaps">
        <SiteProse size="sm" className="mt-4">
        Per <Ref id="gad-69" /> (programmatic-eval priority), every new metric must answer &quot;can
        this be collected programmatically?&quot; before &quot;how do we score it?&quot;. The push is
        to move self-report sources toward deterministic ones &mdash; the gaps are tracked in{" "}
        <a
          href={`${REPO}/blob/main/.planning/docs/GAPS.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-dotted"
        >
          .planning/docs/GAPS.md
        </a>
        .
        </SiteProse>
      </Identified>

      <Identified as="DataHeroTrustCounts" className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DataTrustCount
          label="Deterministic"
          count={totals.deterministic ?? 0}
          tint="success"
        />
        <DataTrustCount label="Human-rated" count={totals.human ?? 0} tint="default" />
        <DataTrustCount label="Authored" count={totals.authored ?? 0} tint="outline" />
        <DataTrustCount
          label="Self-report"
          count={totals["self-report"] ?? 0}
          tint="danger"
        />
      </Identified>
    </SiteSection>
  );
}
