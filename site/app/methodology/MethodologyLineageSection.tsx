import Link from "next/link";
import { GitBranch } from "lucide-react";
import { EvalLineageGraph } from "@/components/charts/EvalLineageGraph";

export function MethodologyLineageSection() {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-3">
          <GitBranch size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Greenfield → brownfield lineage</p>
        </div>
        <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
          Brownfield evals branch from a specific greenfield run&apos;s preserved output. The agent
          starts with the greenfield&apos;s source code and extends it against new or expanded
          requirements. This tests the same 5 hypotheses (bare / planning-only / GAD / emergent /
          GAD+emergent) but for code <strong className="text-foreground">extension</strong> instead
          of creation. Decision{" "}
          <Link href="/decisions#gad-90" className="text-accent underline decoration-dotted">
            gad-90
          </Link>{" "}
          formalizes the lineage model.
        </p>
        <EvalLineageGraph />
        <p className="mt-4 text-[11px] text-muted-foreground">
          <strong className="text-foreground">Data provenance:</strong> nodes are the latest run per
          eval project from <code className="rounded bg-background/60 px-1 py-0.5">EVAL_RUNS</code>.
          Brownfield baselines read from each project&apos;s{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">gad.json baseline</code> field. Edges
          show the source-code inheritance path.
        </p>
      </div>
    </section>
  );
}
