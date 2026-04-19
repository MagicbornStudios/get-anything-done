import type { EvalProjectMeta } from "@/lib/eval-data";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function ProjectScoringWeightsSection({ project }: { project: EvalProjectMeta }) {
  if (!project.scoringWeights) return null;
  // Task 44-16: SiteSection cid alone identifies this surface; the
  // outer Identified wrapper that just restated "ProjectScoringWeights"
  // was removed. The unused Link / SiteProse / Identified imports were
  // dropped along with it.
  return (
    <SiteSection cid="project-scoring-weights-section-site-section" tone="muted">
      <SiteSectionHeading kicker="Scoring weights" preset="section" title="How this project is scored" />
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
    </SiteSection>
  );
}
