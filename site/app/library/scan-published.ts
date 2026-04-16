/**
 * scan-published.ts — server-side helper that walks public/playable/ to
 * discover all published generation builds.
 *
 * Returns an array of PlayableEntry objects enriched with project metadata
 * from the generated eval data when available.
 */

import fs from "node:fs";
import path from "node:path";
import { EVAL_PROJECTS, type EvalProjectMeta } from "@/lib/eval-data";

export interface PlayableEntry {
  project: string;
  species: string;
  version: string;
  /** Absolute URL path served by Next.js static file serving. */
  url: string;
  hasIndex: boolean;
  /** Display name from eval metadata, falls back to project slug. */
  name: string;
  /** Domain from eval metadata (game, app, site, cli, video, etc.). */
  domain: string | null;
  /** Tech stack from eval metadata. */
  techStack: string | null;
}

/** Build a lookup from project slug to the first matching EvalProjectMeta. */
function buildProjectLookup(): Map<string, EvalProjectMeta> {
  const map = new Map<string, EvalProjectMeta>();
  for (const p of EVAL_PROJECTS) {
    const slug = p.project ?? p.id.split("/")[0];
    if (!map.has(slug)) {
      map.set(slug, p);
    }
  }
  return map;
}

/**
 * Walk public/playable/<project>/<species>/<version>/ and return all
 * discovered entries sorted by project, species, then version descending.
 */
export function scanPublished(): PlayableEntry[] {
  const playableRoot = path.resolve(process.cwd(), "public", "playable");
  if (!fs.existsSync(playableRoot)) return [];

  const lookup = buildProjectLookup();
  const entries: PlayableEntry[] = [];

  let projectDirs: string[];
  try {
    projectDirs = fs
      .readdirSync(playableRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }

  for (const project of projectDirs) {
    const projectPath = path.join(playableRoot, project);
    let speciesDirs: string[];
    try {
      speciesDirs = fs
        .readdirSync(projectPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue;
    }

    for (const species of speciesDirs) {
      const speciesPath = path.join(projectPath, species);
      let versionDirs: string[];
      try {
        versionDirs = fs
          .readdirSync(speciesPath, { withFileTypes: true })
          .filter((d) => d.isDirectory() && /^v\d+$/.test(d.name))
          .map((d) => d.name);
      } catch {
        continue;
      }

      for (const version of versionDirs) {
        const indexPath = path.join(speciesPath, version, "index.html");
        const hasIndex = fs.existsSync(indexPath);
        const meta = lookup.get(project);

        entries.push({
          project,
          species,
          version,
          url: `/playable/${project}/${species}/${version}/index.html`,
          hasIndex,
          name: meta?.name ?? project,
          domain: meta?.domain ?? null,
          techStack: meta?.techStack ?? null,
        });
      }
    }
  }

  // Sort: project asc, species asc, version desc (numeric)
  entries.sort((a, b) => {
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    if (a.species !== b.species) return a.species.localeCompare(b.species);
    const aNum = parseInt(a.version.slice(1), 10);
    const bNum = parseInt(b.version.slice(1), 10);
    return bNum - aNum;
  });

  return entries;
}
