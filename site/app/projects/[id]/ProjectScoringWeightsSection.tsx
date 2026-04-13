import { Identified } from "@/components/devid/Identified";
import Link from "next/link";
import type { EvalProjectMeta } from "@/lib/eval-data";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function ProjectScoringWeightsSection({ project }: { project: EvalProjectMeta }) {
  if (!project.scoringWeights) return null;
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading kicker="Scoring weights" preset="section" title="How this project is scored" />
      <Identified as="ProjectScoringWeights">
        <SiteProse size="md" className="mt-3">
          Defined in{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">evals/{project.id}/gad.json</code>. The
          composite score is a weighted sum of these dimensions. See{" "}
          <Link href="/methodology" className="text-accent hover:underline">
            /methodology
          </Link>{" "}
          for the formula and caps.
        </SiteProse>
        <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Dimension</th>
                <th className="px-5 py-3 font-medium tabular-nums">Weight</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(project.scoringWeights)
                .sort((a, b) => b[1] - a[1])
                .map(([dim, w], idx) => (
                  <tr
                    key={dim}
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                  >
                    <td className="px-5 py-3 font-mono text-xs">{dim}</td>
                    <td className="px-5 py-3 tabular-nums text-accent">{w.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Identified>
    </SiteSection>
  );
}
