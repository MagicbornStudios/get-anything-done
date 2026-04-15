import { SKILLS, SKILL_INHERITANCE } from "@/lib/catalog.generated";
import { PRODUCED_ARTIFACTS, ALL_TASKS } from "@/lib/eval-data";
import type { AgentUsageDTO, SkillSummaryDTO, SkillUsageDTO } from "./skills-page-types";

const FUNDAMENTAL_IDS = new Set([
  "create-skill",
  "merge-skill",
  "find-skills",
  "scientific-method",
  "debug",
]);

export function buildSummaries(): SkillSummaryDTO[] {
  return SKILLS.map((s) => {
    const authoredByEvals: string[] = [];
    for (const [runKey, artifacts] of Object.entries(PRODUCED_ARTIFACTS)) {
      if (
        artifacts.skillFiles?.some(
          (f) =>
            f.name === `${s.id}.md` ||
            f.name === `${s.id}/SKILL.md` ||
            f.name.startsWith(`${s.id}-`),
        )
      ) {
        authoredByEvals.push(runKey);
      }
    }
    const inheritedBy = SKILL_INHERITANCE[s.id] ?? [];
    const isFundamental = FUNDAMENTAL_IDS.has(s.id);
    const isFrameworkSkill = s.frameworkSkill === true;
    const category = isFundamental
      ? "fundamental"
      : authoredByEvals.length > 0
        ? "eval-authored"
        : inheritedBy.length > 0
          ? "framework-inherited"
          : "framework-only";
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      imagePath: s.imagePath ?? null,
      inheritedBy,
      isFundamental,
      isFrameworkSkill,
      authoredByEvals,
      category,
    };
  });
}

export function buildSkillUsage(summaries: SkillSummaryDTO[]): SkillUsageDTO[] {
  const catalog = new Set(summaries.map((s) => s.id));
  const map = new Map<string, SkillUsageDTO>();
  for (const t of ALL_TASKS) {
    if (!t.skill) continue;
    const names = t.skill
      .split(",")
      .map((x: string) => x.trim())
      .filter(Boolean);
    for (const name of names) {
      let entry = map.get(name);
      if (!entry) {
        entry = {
          skill: name,
          count: 0,
          tasks: [],
          isCatalogMatch: catalog.has(name),
        };
        map.set(name, entry);
      }
      entry.count += 1;
      entry.tasks.push({
        id: t.id,
        phaseId: t.phaseId,
        status: t.status,
        goal: t.goal,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function buildAgentUsage(): AgentUsageDTO[] {
  const map = new Map<string, AgentUsageDTO & { _skillSet: Set<string> }>();
  for (const t of ALL_TASKS) {
    if (!t.agentId) continue;
    let entry = map.get(t.agentId);
    if (!entry) {
      entry = {
        agent: t.agentId,
        count: 0,
        tasksByType: {},
        skills: [],
        _skillSet: new Set<string>(),
      };
      map.set(t.agentId, entry);
    }
    entry.count += 1;
    if (t.type) {
      entry.tasksByType[t.type] = (entry.tasksByType[t.type] ?? 0) + 1;
    }
    if (t.skill) {
      for (const s of t.skill
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean)) {
        entry._skillSet.add(s);
      }
    }
  }
  return Array.from(map.values())
    .map(({ _skillSet, ...rest }) => ({ ...rest, skills: Array.from(_skillSet).sort() }))
    .sort((a, b) => b.count - a.count);
}
