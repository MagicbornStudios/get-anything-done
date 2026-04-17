import { Dna, GitBranch, Star, Clock } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import { EVAL_PROJECTS, type EvalRunRecord } from "@/lib/eval-data";
import { VOCAB, countLabel } from "@/lib/vocabulary";

interface ProjectStatsBarProps {
  projectName: string;
  runs: EvalRunRecord[];
}

/**
 * Task 45-13: marketing-landing stats bar at the top of the Overview tab.
 * Four numbers that summarise the project at a glance — generation count,
 * best human review across all generations, species count, and the latest
 * generation version + date.
 *
 * Data is derived from the static site data (EVAL_PROJECTS + the runs list
 * the page already resolved). No network, no runtime cost beyond render.
 */
export function ProjectStatsBar({ projectName, runs }: ProjectStatsBarProps) {
  const speciesCount = EVAL_PROJECTS.filter(
    (p) => (p.project ?? p.id.split("/")[0]) === projectName,
  ).length;

  const generationCount = runs.length;

  const scores = runs
    .map((r) => r.humanReviewNormalized?.aggregate_score ?? r.humanReview?.score)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;

  const latest = runs
    .slice()
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  const latestVersion = latest?.version ?? null;
  const latestDate = latest?.date ?? null;

  return (
    <SiteSection cid="project-stats-bar-site-section" className="border-t border-border/40 py-6">
      <Identified as="ProjectStatsBar">
        <div
          data-cid="project-stats-bar-grid"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatCell
            cidKey="generations"
            icon={GitBranch}
            label={countLabel("generation", generationCount)}
            sub={generationCount === 0 ? "none preserved yet" : "preserved builds"}
          />
          <StatCell
            cidKey="species"
            icon={Dna}
            label={countLabel("species", speciesCount)}
            sub={speciesCount === 1 ? "single recipe" : "recipes in brood"}
          />
          <StatCell
            cidKey="review"
            icon={Star}
            label={bestScore !== null ? formatScore(bestScore) : "—"}
            sub={bestScore !== null ? `best ${VOCAB.entities.generation.singular.toLowerCase()} review` : "no review yet"}
          />
          <StatCell
            cidKey="latest"
            icon={Clock}
            label={latestVersion ?? "—"}
            sub={latestDate ? `latest ${formatRelative(latestDate)}` : "no latest"}
          />
        </div>
      </Identified>
    </SiteSection>
  );
}

function StatCell({
  cidKey,
  icon: Icon,
  label,
  sub,
}: {
  cidKey: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  sub: string;
}) {
  return (
    <div
      data-cid={`project-stats-bar-cell-${cidKey}`}
      className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3"
    >
      <Icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/**
 * Human-review scores appear in two shapes across the catalog:
 *   - 0-1 normalized aggregate (humanReviewNormalized.aggregate_score)
 *   - 0-5 or 0-10 raw number (humanReview.score, legacy)
 * Normalize to a "X.X / max" label — if score is <= 1, treat as 0-1; else
 * treat as 0-5 (our rubric default). Good enough for a stats-bar summary.
 */
function formatScore(score: number): string {
  if (score <= 1) {
    return `${(score * 5).toFixed(1)} / 5`;
  }
  if (score <= 5) {
    return `${score.toFixed(1)} / 5`;
  }
  return `${score.toFixed(1)} / 10`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return d.toISOString().slice(0, 10);
}
