import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";
import { SKILL_INHERITANCE, SKILLS } from "@/lib/catalog.generated";

export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function projectRuns(projectId: string): EvalRunRecord[] {
  const slash = projectId.indexOf("/");
  const matches = (r: EvalRunRecord) => {
    if (slash === -1) return r.project === projectId;
    const proj = projectId.slice(0, slash);
    const species = projectId.slice(slash + 1);
    return r.project === proj && r.species === species;
  };
  return EVAL_RUNS.filter(matches).sort((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
}

export function scopedSkillsFor(project: { workflow: string | null; id: string }): {
  kind: "framework" | "bootstrap-only" | "none";
  skills: typeof SKILLS;
  description: string;
} {
  if (project.workflow === "gad") {
    return {
      kind: "framework",
      skills: SKILLS,
      description:
        "GAD runs have the entire framework catalog available via slash commands. Every skill, every subagent, every command is reachable during the run.",
    };
  }
  const inherited = SKILLS.filter((s) =>
    (SKILL_INHERITANCE[s.id] ?? []).includes(project.id)
  );
  if (inherited.length === 0) {
    return {
      kind: "none",
      skills: [],
      description:
        "This project has no framework skills in its bootstrap set. The agent must author its own methodology from scratch.",
    };
  }
  return {
    kind: "bootstrap-only",
    skills: inherited,
    description:
      "This project inherits a minimal bootstrap skill set from the framework. The agent can apply these but must author its own methodology beyond them.",
  };
}
