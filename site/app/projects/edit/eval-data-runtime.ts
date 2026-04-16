/**
 * Runtime eval data loader for the editor (decision gad-203).
 *
 * Replaces static imports from @/lib/eval-data with live filesystem reads
 * via lib/eval-data-access.cjs. Maps the CRUD module's shapes to the
 * existing EvalProjectMeta / EvalRunRecord interfaces so downstream
 * client components remain unchanged.
 *
 * Server-only — requires Node.js fs access.
 */

import { createRequire } from "node:module";
import path from "node:path";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";

/**
 * Dynamic require that bypasses Turbopack's static module resolution.
 * Turbopack traces bare `require()` calls at build time and fails when
 * the target is outside the app tree. `createRequire` produces a require
 * function scoped to a runtime-resolved path, invisible to the bundler.
 */
function getDataAccess() {
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const dynamicRequire = createRequire(path.join(repoRoot, "lib", "package.json"));
  return dynamicRequire("./eval-data-access.cjs");
}

/**
 * Load all eval projects as EvalProjectMeta[] — one row per species.
 * Maps from the CRUD module's project/species shape to the generated TS shape.
 */
export function loadAllProjectMeta(): EvalProjectMeta[] {
  const da = getDataAccess();
  const projects = da.listProjects();
  const result: EvalProjectMeta[] = [];

  for (const p of projects) {
    const projectCfg = da.getProject(p.id);
    if (!projectCfg) continue;

    const speciesRaw = da.listSpecies(p.id);
    const speciesNames = Object.keys(speciesRaw).sort();

    if (speciesNames.length === 0) {
      // Project with no species — emit a single row
      result.push(mapProjectToMeta(p.id, projectCfg, null, null));
      continue;
    }

    for (const sName of speciesNames) {
      const resolved = da.getSpecies(p.id, sName);
      result.push(mapProjectToMeta(p.id, projectCfg, sName, resolved));
    }
  }

  return result;
}

function mapProjectToMeta(
  projectId: string,
  projectCfg: Record<string, unknown>,
  speciesName: string | null,
  speciesCfg: Record<string, unknown> | null,
): EvalProjectMeta {
  const id = speciesName ? `${projectId}/${speciesName}` : projectId;
  return {
    id,
    project: projectId,
    species: speciesName ?? undefined,
    name: (speciesCfg?.name as string) ?? (projectCfg.name as string) ?? projectId,
    description: (speciesCfg?.description as string) ?? (projectCfg.description as string) ?? null,
    workflow: (speciesCfg?.workflow as string) ?? null,
    contextFramework: (speciesCfg?.contextFramework as string) ?? (speciesCfg?.workflow as string) ?? null,
    baseline: (speciesCfg?.baseline as EvalProjectMeta["baseline"]) ?? null,
    constraints: (speciesCfg?.constraints as Record<string, unknown>) ?? null,
    scoringWeights: (projectCfg.scoring as Record<string, number>) ?? null,
    humanReviewRubric: (projectCfg.humanReviewRubric as EvalProjectMeta["humanReviewRubric"]) ?? null,
    domain: (projectCfg.domain as string) ?? null,
    techStack: (projectCfg.techStack as string) ?? null,
    buildRequirement: null,
    published: (projectCfg.published as boolean) === true,
  };
}

/**
 * Load all eval runs as EvalRunRecord[] — one row per generation.
 * Maps from the CRUD module's generation shape to the generated TS shape.
 */
export function loadAllRunRecords(): EvalRunRecord[] {
  const da = getDataAccess();
  const projects = da.listProjects();
  const result: EvalRunRecord[] = [];

  for (const p of projects) {
    const speciesRaw = da.listSpecies(p.id);
    for (const sName of Object.keys(speciesRaw)) {
      const generations = da.listGenerations(p.id, sName);
      for (const gen of generations) {
        result.push(mapGenerationToRun(p.id, sName, gen));
      }
    }
  }

  return result;
}

function mapGenerationToRun(
  projectId: string,
  speciesName: string,
  gen: {
    version: string;
    trace: Record<string, unknown> | null;
    hasTrace: boolean;
  },
): EvalRunRecord {
  const trace = gen.trace ?? {};
  return {
    project: projectId,
    species: speciesName,
    id: `${projectId}/${speciesName}/${gen.version}`,
    version: gen.version,
    workflow: ((trace.workflow as string) ?? "unknown") as EvalRunRecord["workflow"],
    requirementsVersion: (trace.requirements_version as string) ?? "unknown",
    date: (trace.date as string) ?? null,
    gadVersion: (trace.gad_version as string) ?? null,
    traceSchemaVersion: (trace.trace_schema_version as number) ?? 0,
    frameworkVersion: (trace.framework_version as string) ?? null,
    frameworkCommit: null,
    frameworkBranch: null,
    frameworkCommitTs: null,
    frameworkStamp: null,
    runtimeIdentity: (trace.runtime_identity as Record<string, unknown>) ?? null,
    runtimesInvolved: [],
    traceEvents: null,
    agentLineage: null,
    evalType: (trace.eval_type as string) ?? "unknown",
    contextMode: (trace.context_mode as string) ?? null,
    timing: (trace.timing as EvalRunRecord["timing"]) ?? null,
    tokenUsage: (trace.token_usage as EvalRunRecord["tokenUsage"]) ?? null,
    scores: (trace.scores as EvalRunRecord["scores"]) ?? { requirement_coverage: null, human_review: null, composite: null },
    humanReview: (trace.human_review as EvalRunRecord["humanReview"]) ?? null,
    humanReviewNormalized: {
      rubric_version: "unknown",
      dimensions: {},
      aggregate_score: null,
      notes: null,
      reviewed_by: null,
      reviewed_at: null,
      is_legacy: true,
      is_empty: true,
    },
    gitAnalysis: null,
    planningQuality: null,
    requirementCoverage: null,
    workflowEmergence: null,
    requirementsDoc: null,
    topSkill: null,
    skillAccuracyBreakdown: null,
    skillsProvenance: null,
  };
}
