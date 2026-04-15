import { SKILLS, SKILL_INHERITANCE } from "@/lib/catalog.generated";
import { PRODUCED_ARTIFACTS, ALL_TASKS } from "@/lib/eval-data";
import fs from "node:fs";
import path from "node:path";
import type { AgentUsageDTO, SkillSummaryDTO, SkillUsageDTO } from "./skills-page-types";

const FUNDAMENTAL_IDS = new Set([
  "create-skill",
  "merge-skill",
  "find-skills",
  "scientific-method",
  "debug",
]);

export function buildSummaries(): SkillSummaryDTO[] {
  const official = SKILLS.map((s) => {
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
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      imagePath: s.imagePath ?? null,
      inheritedBy,
      isFundamental,
      isFrameworkSkill,
      authoredByEvals,
      category: "official",
      origin: "official" as const,
    };
  });
  const proto = readProtoSkillSummaries();
  return [...official, ...proto].sort((a, b) => a.id.localeCompare(b.id));
}

function readProtoSkillSummaries(): SkillSummaryDTO[] {
  const repoRoot = path.resolve(process.cwd(), "..");
  const protoRoot = path.join(repoRoot, ".planning", "proto-skills");
  if (!fs.existsSync(protoRoot)) return [];
  const out: SkillSummaryDTO[] = [];
  for (const entry of fs.readdirSync(protoRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    const skillFile = path.join(protoRoot, id, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    const src = fs.readFileSync(skillFile, "utf8");
    const description = extractFrontmatterValue(src, "description") || "Proto-skill draft pending review.";
    const name = extractFrontmatterValue(src, "name") || id;
    const imagePath = fs.existsSync(path.join(repoRoot, "site", "public", "skills", `${id}.png`))
      ? `/skills/${id}.png`
      : null;
    out.push({
      id,
      name,
      description,
      imagePath,
      inheritedBy: [],
      isFundamental: false,
      isFrameworkSkill: false,
      authoredByEvals: [],
      category: "proto",
      origin: "proto",
    });
  }
  return out;
}

function extractFrontmatterValue(src: string, key: string): string | null {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const kv = m[1].match(re);
  if (!kv) return null;
  return kv[1].trim().replace(/^["']|["']$/g, "");
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
