/**
 * project-planning-data.ts -- server-side data loader for planning XML files.
 *
 * Task 45-02: per-project data adapter for planning tabs.
 *
 * Reads TASK-REGISTRY.xml, DECISIONS.xml, ROADMAP.xml, STATE.xml, and
 * REQUIREMENTS.xml for a given project using the existing CJS reader libs.
 * Uses createRequire to bypass Turbopack static analysis (same pattern as
 * eval-data-runtime.ts, per decision gad-203).
 *
 * Server-only -- requires Node.js fs access.
 */

import { createRequire } from "node:module";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  REGISTERED_PROJECTS,
  type RegisteredProject,
} from "@/lib/project-config.generated";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanningTask {
  id: string;
  goal: string;
  status: string;
  phase: string;
  keywords: string;
  depends: string;
  skill: string;
  type: string;
  agentId: string;
  agentRole: string;
  runtime: string;
  modelProfile: string;
  resolvedModel: string;
  claimed: boolean;
  claimedAt: string;
  leaseExpiresAt: string;
  commands: string[];
  files: string[];
}

export interface PlanningDecision {
  id: string;
  title: string;
  summary: string;
  impact: string;
  references: string[];
}

export interface PlanningPhase {
  id: string;
  title: string;
  goal: string;
  status: "done" | "active" | "planned" | "cancelled";
  depends: string;
  milestone: string;
  plans: string;
  requirements: string;
  description: string;
}

export interface PlanningRequirement {
  kind: string;
  docPath: string;
  description: string;
}

export interface PlanningState {
  projectId: string;
  path: string;
  planningDir: string;
  currentPhase: string | null;
  milestone: string | null;
  status: string;
  openTasks: number;
  phasesComplete: number;
  phasesTotal: number;
  lastActivity: string | null;
  nextAction: string | null;
}

export interface ProjectPlanningData {
  tasks: PlanningTask[];
  decisions: PlanningDecision[];
  phases: PlanningPhase[];
  requirements: PlanningRequirement[];
  state: PlanningState | null;
}

// ---------------------------------------------------------------------------
// CJS reader access via createRequire (bypasses Turbopack)
// ---------------------------------------------------------------------------

interface TaskRegistryReader {
  readTasks(
    root: { id: string; path: string; planningDir: string },
    baseDir: string,
    filter?: { status?: string; phase?: string },
  ): PlanningTask[];
}

interface DecisionsReader {
  readDecisions(
    root: { id: string; path: string; planningDir: string },
    baseDir: string,
    filter?: { id?: string },
  ): PlanningDecision[];
}

interface RoadmapReader {
  readPhases(
    root: { id: string; path: string; planningDir: string },
    baseDir: string,
  ): PlanningPhase[];
}

interface RequirementsReader {
  readRequirements(
    root: { id: string; path: string; planningDir: string },
    baseDir: string,
  ): PlanningRequirement[];
}

interface StateReader {
  readState(
    root: { id: string; path: string; planningDir: string },
    baseDir: string,
  ): PlanningState;
}

let _readers: {
  taskRegistry: TaskRegistryReader;
  decisions: DecisionsReader;
  roadmap: RoadmapReader;
  requirements: RequirementsReader;
  state: StateReader;
} | null = null;

function getReaders() {
  if (_readers) return _readers;

  const siteDir = process.cwd();
  const gadRoot = path.resolve(siteDir, "..");
  const dynamicRequire = createRequire(
    path.join(gadRoot, "lib", "package.json"),
  );

  _readers = {
    taskRegistry: dynamicRequire(
      "./task-registry-reader.cjs",
    ) as TaskRegistryReader,
    decisions: dynamicRequire("./decisions-reader.cjs") as DecisionsReader,
    roadmap: dynamicRequire("./roadmap-reader.cjs") as RoadmapReader,
    requirements: dynamicRequire(
      "./requirements-reader.cjs",
    ) as RequirementsReader,
    state: dynamicRequire("./state-reader.cjs") as StateReader,
  };
  return _readers;
}

// ---------------------------------------------------------------------------
// Project resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a projectId to its filesystem root and planning directory.
 * Uses the build-time REGISTERED_PROJECTS list from project-config.generated.ts.
 * Returns null if the project is not found or has no .planning/ directory.
 */
function resolveProjectRoot(
  projectId: string,
): { project: RegisteredProject; baseDir: string; planningDir: string } | null {
  const project = REGISTERED_PROJECTS.find((p) => p.id === projectId);
  if (!project) return null;

  // The reader libs expect a root object { id, path, planningDir } where
  // path is relative to baseDir. We set baseDir = project.path and path = "."
  // so the reader resolves to project.path/.planning/.
  const planningDir = path.join(project.path, ".planning");
  if (!fs.existsSync(planningDir)) return null;

  return { project, baseDir: project.path, planningDir: ".planning" };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all planning data for a project.
 * Returns typed arrays for tasks, decisions, phases, requirements, and state.
 * Returns null if the projectId cannot be resolved or has no .planning/ dir.
 */
export function loadProjectPlanningData(
  projectId: string,
): ProjectPlanningData | null {
  const resolved = resolveProjectRoot(projectId);
  if (!resolved) return null;

  const root = {
    id: projectId,
    path: ".",
    planningDir: resolved.planningDir,
  };
  const baseDir = resolved.baseDir;
  const readers = getReaders();

  const tasks = safeRead(() => readers.taskRegistry.readTasks(root, baseDir));
  const decisions = safeRead(() =>
    readers.decisions.readDecisions(root, baseDir),
  );
  const phases = safeRead(() => readers.roadmap.readPhases(root, baseDir));
  const requirements = safeRead(() =>
    readers.requirements.readRequirements(root, baseDir),
  );
  const state = safeRead(() => readers.state.readState(root, baseDir));

  return {
    tasks,
    decisions,
    phases,
    requirements,
    state: state.length > 0 ? state[0] : null,
  };
}

/**
 * Load tasks only (lighter weight for task-focused views).
 */
export function loadProjectTasks(
  projectId: string,
  filter?: { status?: string; phase?: string },
): PlanningTask[] {
  const resolved = resolveProjectRoot(projectId);
  if (!resolved) return [];

  const root = {
    id: projectId,
    path: ".",
    planningDir: resolved.planningDir,
  };
  const readers = getReaders();
  return safeRead(() =>
    readers.taskRegistry.readTasks(root, resolved.baseDir, filter),
  );
}

/**
 * Load decisions only.
 */
export function loadProjectDecisions(
  projectId: string,
): PlanningDecision[] {
  const resolved = resolveProjectRoot(projectId);
  if (!resolved) return [];

  const root = {
    id: projectId,
    path: ".",
    planningDir: resolved.planningDir,
  };
  const readers = getReaders();
  return safeRead(() =>
    readers.decisions.readDecisions(root, resolved.baseDir),
  );
}

/**
 * Load phases only.
 */
export function loadProjectPhases(
  projectId: string,
): PlanningPhase[] {
  const resolved = resolveProjectRoot(projectId);
  if (!resolved) return [];

  const root = {
    id: projectId,
    path: ".",
    planningDir: resolved.planningDir,
  };
  const readers = getReaders();
  return safeRead(() => readers.roadmap.readPhases(root, resolved.baseDir));
}

/**
 * Load state only.
 */
export function loadProjectState(
  projectId: string,
): PlanningState | null {
  const resolved = resolveProjectRoot(projectId);
  if (!resolved) return null;

  const root = {
    id: projectId,
    path: ".",
    planningDir: resolved.planningDir,
  };
  const readers = getReaders();
  try {
    return readers.state.readState(root, resolved.baseDir);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a reader call so a missing/corrupt file returns [] instead of throwing. */
function safeRead<T>(fn: () => T): T extends unknown[] ? T : T[] {
  try {
    const result = fn();
    if (Array.isArray(result)) return result as T extends unknown[] ? T : T[];
    // State reader returns a single object; wrap it for uniform handling upstream
    return [result] as T extends unknown[] ? T : T[];
  } catch {
    return [] as unknown as T extends unknown[] ? T : T[];
  }
}
