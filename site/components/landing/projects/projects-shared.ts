import {
  EVAL_RUNS,
  EVAL_TEMPLATES,
  PLANNING_ZIPS,
  type Workflow,
} from "@/lib/eval-data";

export interface ProjectCard {
  project: string;
  mode: "greenfield" | "brownfield";
  workflow: Workflow;
  description: string;
  status: "active" | "planned";
}

export const PROJECTS: ProjectCard[] = [
  {
    project: "escape-the-dungeon",
    mode: "greenfield",
    workflow: "gad",
    description:
      "Full GAD framework from empty repo. Every phase planned, every task committed with an id, every decision captured.",
    status: "active",
  },
  {
    project: "escape-the-dungeon-bare",
    mode: "greenfield",
    workflow: "bare",
    description:
      "No framework. No CLI. The agent gets AGENTS.md + REQUIREMENTS.xml + two bootstrap skills and is told to organise itself however it wants.",
    status: "active",
  },
  {
    project: "escape-the-dungeon-emergent",
    mode: "greenfield",
    workflow: "emergent",
    description:
      "No framework, but inherits skills from previous bare/emergent runs. Evolves them in place and ships a CHANGELOG documenting what was rewritten.",
    status: "active",
  },
  {
    project: "etd-brownfield-gad",
    mode: "brownfield",
    workflow: "gad",
    description:
      "Extends the bare v3 baseline with v4 pressure requirements under the full GAD framework. Tests whether structured planning pays off on codebase extension.",
    status: "planned",
  },
  {
    project: "etd-brownfield-bare",
    mode: "brownfield",
    workflow: "bare",
    description:
      "Same bare v3 baseline, same v4 extensions, no framework. The control condition for the freedom-hypothesis re-test.",
    status: "planned",
  },
  {
    project: "etd-brownfield-emergent",
    mode: "brownfield",
    workflow: "emergent",
    description:
      "Bare v3 baseline + v4 extensions with inherited skills from round 3 emergent runs. The most experienced configuration.",
    status: "planned",
  },
];

export function projectRuns(project: string) {
  return EVAL_RUNS.filter((r) => r.project === project);
}

export function latestRun(project: string) {
  const runs = projectRuns(project);
  if (runs.length === 0) return null;
  return runs.reduce((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av >= bv ? a : b;
  });
}

export function findTemplate(project: string) {
  return EVAL_TEMPLATES.find((t) => t.project === project);
}

export function findPlanning(project: string) {
  return PLANNING_ZIPS.find((p) => p.project === project);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
