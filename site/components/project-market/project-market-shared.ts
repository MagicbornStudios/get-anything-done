/**
 * Shared constants and helpers for the /project-market page.
 * Centralizes featured project IDs, round window defaults, and
 * domain categorization so the catalog is easy to tune.
 */

import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";

// --- Featured projects ---------------------------------------------------

export const FEATURED_PROJECT_IDS = [
  "escape-the-dungeon",
  "escape-the-dungeon-bare",
  "escape-the-dungeon-emergent",
  "gad-explainer-video",
] as const;

/** True when a project is in the featured set. */
export function isFeaturedProject(id: string): boolean {
  return (FEATURED_PROJECT_IDS as readonly string[]).includes(id);
}

// --- Default round window ------------------------------------------------

/**
 * Per-project "last N rounds" window. Runs whose round falls outside the
 * window are hidden by default but can be revealed via filters.
 */
export const DEFAULT_ROUND_LIMIT_PER_PROJECT = 5;

/**
 * Returns only runs within the last `limit` distinct rounds *for their
 * own project*. Uses `roundForRun()` from hypothesis-tracks-shared.
 */
export function applyPerProjectRoundWindow(
  runs: EvalRunRecord[],
  limit = DEFAULT_ROUND_LIMIT_PER_PROJECT,
): EvalRunRecord[] {
  // Group runs by project, find the latest N rounds per project
  const projectRounds = new Map<string, Set<string>>();
  for (const r of runs) {
    const round = roundForRun(r);
    if (!round) continue;
    const existing = projectRounds.get(r.project) ?? new Set<string>();
    existing.add(round);
    projectRounds.set(r.project, existing);
  }

  // For each project, keep only the last `limit` rounds (sorted desc)
  const allowedRounds = new Map<string, Set<string>>();
  for (const [project, rounds] of projectRounds) {
    const sorted = [...rounds].sort((a, b) => {
      const an = parseInt(a.replace("Round ", ""), 10) || 0;
      const bn = parseInt(b.replace("Round ", ""), 10) || 0;
      return bn - an; // desc
    });
    allowedRounds.set(project, new Set(sorted.slice(0, limit)));
  }

  return runs.filter((r) => {
    const round = roundForRun(r);
    if (!round) return true; // No round info => always show
    const allowed = allowedRounds.get(r.project);
    return allowed ? allowed.has(round) : true;
  });
}

// --- Domain categorization -----------------------------------------------

export type ProjectDomain = "game" | "video" | "software" | "tooling" | "planning";

const DOMAIN_MAP: Record<string, ProjectDomain> = {
  "escape-the-dungeon": "game",
  "escape-the-dungeon-bare": "game",
  "escape-the-dungeon-emergent": "game",
  "escape-the-dungeon-gad-emergent": "game",
  "escape-the-dungeon-planning-only": "game",
  "etd-brownfield-bare": "game",
  "etd-brownfield-emergent": "game",
  "etd-brownfield-gad": "game",
  "etd-babylonjs": "game",
  "etd-phaser": "game",
  "etd-pixijs": "game",
  "etd-threejs": "game",
  "gad-explainer-video": "video",
  "gad-explainer-video-bare": "video",
  "gad-explainer-video-emergent": "video",
  "skill-evaluation-app": "software",
  "eval-skill-install-eval": "tooling",
  "gad-skill-creator-eval": "tooling",
  "gad-planning-loop": "tooling",
  "reverse-engineer-eval": "tooling",
  "cli-efficiency": "tooling",
  "portfolio-bare": "planning",
  "project-migration": "planning",
  "planning-migration": "planning",
};

export function domainForProject(id: string): ProjectDomain {
  return DOMAIN_MAP[id] ?? "tooling";
}

export const DOMAIN_LABELS: Record<ProjectDomain, string> = {
  game: "Game",
  video: "Video",
  software: "Software",
  tooling: "Tooling",
  planning: "Planning",
};

export const DOMAIN_TINT: Record<ProjectDomain, string> = {
  game: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  video: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  software: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  tooling: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  planning: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
};

// --- Project enrichment --------------------------------------------------

export interface EnrichedProject extends EvalProjectMeta {
  domain: ProjectDomain;
  featured: boolean;
  runCount: number;
  playableCount: number;
  latestRound: string | null;
  rounds: string[];
}

export function enrichProjects(
  projects: EvalProjectMeta[],
  runs: EvalRunRecord[],
  playableIndex: Record<string, string>,
): EnrichedProject[] {
  return projects.map((p) => {
    const projectRuns = runs.filter((r) => r.project === p.id);
    const rounds = new Set<string>();
    for (const r of projectRuns) {
      const round = roundForRun(r);
      if (round) rounds.add(round);
    }
    const sortedRounds = [...rounds].sort((a, b) => {
      const an = parseInt(a.replace("Round ", ""), 10) || 0;
      const bn = parseInt(b.replace("Round ", ""), 10) || 0;
      return bn - an;
    });
    const playableCount = projectRuns.filter(
      (r) => playableIndex[`${r.project}/${r.version}`],
    ).length;

    return {
      ...p,
      domain: domainForProject(p.id),
      featured: isFeaturedProject(p.id),
      runCount: projectRuns.length,
      playableCount,
      latestRound: sortedRounds[0] ?? null,
      rounds: sortedRounds,
    };
  });
}
