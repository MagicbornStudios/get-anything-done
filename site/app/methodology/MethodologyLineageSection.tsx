import Link from "next/link";
import { GitBranch } from "lucide-react";
import { EvalLineageGraph } from "@/components/charts/EvalLineageGraph";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function MethodologyLineageSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={GitBranch}
        kicker="Greenfield → brownfield lineage"
        kickerRowClassName="mb-6 gap-3"
      />
      <SiteProse size="sm" className="mb-6">
        Brownfield evals branch from a specific greenfield run&apos;s preserved output. The agent
        starts with the greenfield&apos;s source code and extends it against new or expanded
        requirements. This tests the same 5 hypotheses (bare / planning-only / GAD / emergent /
        GAD+emergent) but for code <strong className="text-foreground">extension</strong> instead of
        creation. Decision{" "}
        <Link href="/decisions#gad-90" className="text-accent underline decoration-dotted">
          gad-90
        </Link>{" "}
        formalizes the lineage model.
      </SiteProse>
      <EvalLineageGraph />
      <p className="mt-4 text-[11px] text-muted-foreground">
        <strong className="text-foreground">Data provenance:</strong> nodes are the latest run per
        eval project from <code className="rounded bg-background/60 px-1 py-0.5">EVAL_RUNS</code>.
        Brownfield baselines read from each project&apos;s{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">gad.json baseline</code> field. Edges
        show the source-code inheritance path.
      </p>
    </SiteSection>
  );
}
