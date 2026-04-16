import type { CatalogSkill } from "@/lib/catalog.generated";
import type { EvalRunRecord } from "@/lib/eval-data";
import { playableUrl } from "@/lib/eval-data";

/** Map TRACE / slash-command tokens to likely catalog ids (e.g. `/gad:plan-phase` → `gad-plan-phase`). */
export function traceSkillTokenToCatalogId(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^\/?gad:([\w-]+)/i);
  const short = m ? m[1]! : t.replace(/^gad:/i, "").replace(/^\//, "").trim();
  if (!short) return null;
  if (short.startsWith("gad-")) return short;
  return `gad-${short}`;
}

export function latestProjectRun(runs: EvalRunRecord[]): EvalRunRecord | null {
  if (runs.length === 0) return null;
  let best = runs[0]!;
  let bestV = parseInt(best.version.slice(1), 10) || 0;
  for (const r of runs) {
    const v = parseInt(r.version.slice(1), 10) || 0;
    if (v > bestV) {
      best = r;
      bestV = v;
    }
  }
  return best;
}

export type ProjectSkillScopeRow = {
  skillId: string;
  label: string;
  subtitle: string | null;
  imagePath: string | null;
  /** 0–100 when telemetry + playable exist; null when bars are hidden */
  usagePercent: number | null;
  triggered: boolean | null;
  rawToken: string | null;
  sourcePath: string;
  bodyRaw: string;
  /** Total invocations across all generations in the brood (from TRACE.json skill_triggers). */
  broodInvocations: number;
};

function findCatalogSkill(
  skillsById: Map<string, CatalogSkill>,
  catalogId: string | null,
): CatalogSkill | null {
  if (!catalogId) return null;
  if (skillsById.has(catalogId)) return skillsById.get(catalogId)!;
  return null;
}

/** Max rows when filling the framework catalog so the panel stays scrollable and fast. */
const FRAMEWORK_CATALOG_LIST_CAP = 40;

function trimSkillSubtitle(description: string | null | undefined): string | null {
  if (!description) return null;
  return `${description.slice(0, 117)}${description.length > 117 ? "…" : ""}`;
}

function rowFromCatalogSkill(cat: CatalogSkill, broodInvocations = 0): ProjectSkillScopeRow {
  return {
    skillId: cat.id,
    label: cat.name,
    subtitle: trimSkillSubtitle(cat.description),
    imagePath: cat.imagePath ?? null,
    usagePercent: null,
    triggered: null,
    rawToken: null,
    sourcePath: cat.file,
    bodyRaw: cat.bodyRaw,
    broodInvocations,
  };
}

/** Append framework catalog rows (stable sort) until cap; skips ids already in `rows`. */
function appendFrameworkCatalogPreview(
  rows: ProjectSkillScopeRow[],
  skillsById: Map<string, CatalogSkill>,
  cap: number,
  brood: Record<string, number> = {},
) {
  const seen = new Set(rows.map((r) => r.skillId));
  const sorted = [...skillsById.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const cat of sorted) {
    if (rows.length >= cap) break;
    if (seen.has(cat.id)) continue;
    seen.add(cat.id);
    rows.push(rowFromCatalogSkill(cat, brood[cat.id] ?? 0));
  }
}

export function buildProjectSkillScopeRows(params: {
  scope: { kind: "framework" | "bootstrap-only" | "none"; skills: CatalogSkill[] };
  latestRun: EvalRunRecord | null;
  skillsById: Map<string, CatalogSkill>;
  /** Aggregated skill trigger counts across all generations in this project's brood. */
  broodAggregation?: Record<string, number>;
}): {
  rows: ProjectSkillScopeRow[];
  latestVersion: string | null;
  hasPlayableBuild: boolean;
  hasTriggerTelemetry: boolean;
  hasBroodTelemetry: boolean;
  catalogTotal: number;
  broodTotal: number;
} {
  const { scope, latestRun, skillsById, broodAggregation } = params;
  const brood = broodAggregation ?? {};
  const broodTotal = Object.values(brood).reduce((s, n) => s + n, 0);
  const hasBroodTelemetry = broodTotal > 0;
  const triggers = latestRun?.skillAccuracyBreakdown?.expected_triggers ?? [];
  const hasTriggerTelemetry = triggers.length > 0;
  const hasPlayableBuild = latestRun ? Boolean(playableUrl(latestRun)) : false;
  const showBars = hasPlayableBuild && hasTriggerTelemetry;

  const rows: ProjectSkillScopeRow[] = [];

  if (hasTriggerTelemetry) {
    for (const tr of triggers) {
      const token = typeof tr.skill === "string" ? tr.skill : "";
      const catalogId = traceSkillTokenToCatalogId(token);
      const cat = findCatalogSkill(skillsById, catalogId);
      const triggered = typeof tr.triggered === "boolean" ? tr.triggered : null;
      const pct = showBars && triggered !== null ? (triggered ? 100 : 0) : null;
      const when = typeof tr.when === "string" ? tr.when : null;
      const resolvedId = cat?.id ?? catalogId ?? token;
      rows.push({
        skillId: resolvedId,
        label: cat?.name ?? catalogId ?? token,
        subtitle: when,
        imagePath: cat?.imagePath ?? null,
        usagePercent: pct,
        triggered,
        rawToken: token,
        sourcePath: cat?.file ?? `skills/${catalogId ?? "unknown"}/SKILL.md`,
        bodyRaw: cat?.bodyRaw ?? `No catalog SKILL.md matched this trace token.\n\nToken: ${token}\n\nOpen the skills grid or run prebuild after adding the skill.`,
        broodInvocations: brood[resolvedId] ?? 0,
      });
    }
    if (scope.kind === "bootstrap-only" && scope.skills.length > 0) {
      const seen = new Set(rows.map((r) => r.skillId));
      for (const cat of scope.skills) {
        if (seen.has(cat.id)) continue;
        seen.add(cat.id);
        rows.push(rowFromCatalogSkill(cat, brood[cat.id] ?? 0));
      }
    }
  } else if (hasBroodTelemetry) {
    // No expected_triggers from latest run but we have brood-level aggregation.
    // Build rows from the aggregated skill data.
    const sortedSkills = Object.entries(brood).sort(([, a], [, b]) => b - a);
    for (const [skillId, count] of sortedSkills) {
      const cat = findCatalogSkill(skillsById, skillId);
      rows.push({
        skillId: cat?.id ?? skillId,
        label: cat?.name ?? skillId,
        subtitle: null,
        imagePath: cat?.imagePath ?? null,
        usagePercent: null,
        triggered: null,
        rawToken: null,
        sourcePath: cat?.file ?? `skills/${skillId}/SKILL.md`,
        bodyRaw: cat?.bodyRaw ?? `No catalog SKILL.md matched this aggregated skill id.\n\nId: ${skillId}`,
        broodInvocations: count,
      });
    }
    // Append scoped skills not already listed
    if (scope.kind !== "framework" && scope.skills.length > 0) {
      const seen = new Set(rows.map((r) => r.skillId));
      for (const cat of scope.skills) {
        if (seen.has(cat.id)) continue;
        seen.add(cat.id);
        rows.push(rowFromCatalogSkill(cat, 0));
      }
    }
  } else if (scope.kind !== "framework" && scope.skills.length > 0) {
    for (const cat of scope.skills) {
      rows.push(rowFromCatalogSkill(cat, brood[cat.id] ?? 0));
    }
  }

  if (scope.kind === "framework") {
    appendFrameworkCatalogPreview(rows, skillsById, FRAMEWORK_CATALOG_LIST_CAP, brood);
  }

  return {
    rows,
    latestVersion: latestRun?.version ?? null,
    hasPlayableBuild,
    hasTriggerTelemetry,
    hasBroodTelemetry,
    catalogTotal: scope.kind === "framework" ? skillsById.size : scope.skills.length,
    broodTotal,
  };
}

