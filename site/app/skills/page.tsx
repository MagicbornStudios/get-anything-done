import Link from "next/link";
import { MarketingShell, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { SKILLS, SKILL_INHERITANCE } from "@/lib/catalog.generated";
import { PRODUCED_ARTIFACTS, ALL_TASKS } from "@/lib/eval-data";
import {
  SkillsPageTabs,
  type SkillSummaryDTO,
  type SkillUsageDTO,
  type AgentUsageDTO,
} from "./SkillsPageTabs";

export const metadata = {
  title: "Skills — GAD",
  description:
    "Every authored skill in the GAD framework, plus real usage stats and agent attribution data from TASK-REGISTRY.xml.",
};

const FUNDAMENTAL_IDS = new Set([
  "create-skill",
  "merge-skill",
  "find-skills",
  "scientific-method",
  "debug",
]);

function buildSummaries(): SkillSummaryDTO[] {
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
      inheritedBy,
      isFundamental,
      isFrameworkSkill,
      authoredByEvals,
      category,
    };
  });
}

function buildSkillUsage(summaries: SkillSummaryDTO[]): SkillUsageDTO[] {
  const catalog = new Set(summaries.map((s) => s.id));
  const map = new Map<string, SkillUsageDTO>();
  for (const t of ALL_TASKS) {
    if (!t.skill) continue;
    const names = t.skill.split(",").map((x: string) => x.trim()).filter(Boolean);
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

function buildAgentUsage(): AgentUsageDTO[] {
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
      for (const s of t.skill.split(",").map((x: string) => x.trim()).filter(Boolean)) {
        entry._skillSet.add(s);
      }
    }
  }
  return Array.from(map.values())
    .map(({ _skillSet, ...rest }) => ({ ...rest, skills: Array.from(_skillSet).sort() }))
    .sort((a, b) => b.count - a.count);
}

export default function SkillsIndexPage() {
  const summaries = buildSummaries();
  const usage = buildSkillUsage(summaries);
  const agents = buildAgentUsage();

  const totalSkills = summaries.length;
  const categoryCount = (cat: string) => summaries.filter((s) => s.category === cat).length;

  return (
    <MarketingShell>
      <SiteSection>
        <SiteSectionHeading
          kicker="Skills"
          as="h1"
          preset="hero"
          title={
            <>
              Every authored skill. <span className="gradient-text">With provenance + real usage.</span>
            </>
          }
        />
        <SiteProse className="mt-6">
          The GAD skill catalog, filterable by category, searchable, and cross-referenced against
          real attribution data from <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">.planning/TASK-REGISTRY.xml</code>.
          The Usage tab shows every skill that&apos;s been tagged on a completed task. The Agents
          tab aggregates by agent identity (claude-code, codex, cursor, or named subagents) so
          you can see who did what.
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          Provenance per skill (origin run, inheritance lineage, evaluation performance context) per{" "}
          <Link href="/decisions#gad-76" className="text-accent underline decoration-dotted">
            GAD-D-76
          </Link>
          . Attribution mandate per{" "}
          <Link href="/decisions#gad-104" className="text-accent underline decoration-dotted">
            GAD-D-104
          </Link>
          . GAD skills follow the format in the{" "}
          <Link href="/standards" className="text-accent underline decoration-dotted">
            Anthropic skills guide + agentskills.io standard
          </Link>
          .
        </SiteProse>

        <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
          <Stat label="Total skills" value={totalSkills.toString()} />
          <Stat label="Fundamental" value={categoryCount("fundamental").toString()} />
          <Stat label="Eval-authored" value={categoryCount("eval-authored").toString()} />
          <Stat label="Framework-inherited" value={categoryCount("framework-inherited").toString()} />
          <Stat label="Skills used" value={usage.length.toString()} />
          <Stat label="Agents tracked" value={agents.length.toString()} />
        </div>
      </SiteSection>

      <SiteSection tone="muted" className="border-t border-border/60">
        <SkillsPageTabs summaries={summaries} usage={usage} agents={agents} />
      </SiteSection>
    </MarketingShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
