import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";

export function ContentDrivenHeroSection() {
  return (
    <SiteSection>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge
          variant="default"
          className="inline-flex items-center gap-1.5 border-pink-500/40 bg-pink-500/10 text-pink-300"
        >
          Content-driven hypothesis
        </Badge>
        <Badge variant="outline">planned — no runs yet</Badge>
      </div>
      <SiteSectionHeading
        kicker="Content-driven"
        as="h1"
        preset="hero"
        title={
          <>
            Give the agent a <span className="gradient-text">content pack</span> and see what it builds.
          </>
        }
      />
      <SiteProse className="mt-6">
        The content-driven hypothesis (<Ref id="gad-66" />) is a planned eval track that gives the agent the usual
        requirements <em>plus</em> a pre-authored content pack — spells, runes, items, NPCs, dialogue trees, encounter
        tables — extracted from a prior successful run. The research question: does the agent produce a more fleshed-out
        game when the authored canon exists to build on? User framing: &quot;analogous to making a movie based on a book.
        Derivative, but not all processes are, much like a forger might not use the exact same brush.&quot;
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        This track is <strong className="text-pink-300">explicitly distinct</strong> from freedom and CSH. Content-pack
        runs and greenfield runs do <strong>not</strong> share a rubric — they answer different questions. Comparing them
        on the same score would confound the compound-skills measurement.
      </SiteProse>

      <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
        <div className="mb-2 flex items-center gap-2 text-amber-100">
          <AlertTriangle size={14} aria-hidden />
          <strong>Not yet tested</strong>
        </div>
        <p className="text-xs">
          No runs have been produced against this hypothesis yet. The eval project doesn&apos;t exist yet. Dependencies:
          (1) content-extraction CLI (<Ref id="gad-66" />) that pulls an authored canon out of a preserved run, (2) a
          new eval flavor{" "}
          <code className="rounded bg-amber-500/10 px-1">escape-the-dungeon-inherited-content</code> that consumes it, (3)
          a distinct rubric scoring the &quot;derivative coherence&quot; quality.
        </p>
      </div>
    </SiteSection>
  );
}
