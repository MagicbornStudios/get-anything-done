/**
 * Auto-generated from evals/<project>/<version>/TRACE.json files.
 * DO NOT EDIT BY HAND â€” run `npm run prebuild` to regenerate.
 */
export type Workflow = "gad" | "bare" | "emergent";
export type EvalScores = {
    requirement_coverage?: number | null;
    planning_quality?: number | null;
    per_task_discipline?: number | null;
    skill_accuracy?: number | null;
    time_efficiency?: number | null;
    human_review?: number | null;
    workflow_emergence?: number | null;
    implementation_quality?: number | null;
    iteration_evidence?: number | null;
    composite?: number | null;
} & Record<string, number | null | undefined>;
export interface EvalRunRecord {
    project: string;
    species?: string | null;
    id?: string;
    version: string;
    workflow: Workflow;
    requirementsVersion: string;
    date: string | null;
    gadVersion: string | null;
    traceSchemaVersion: number;
    frameworkVersion: string | null;
    frameworkCommit: string | null;
    frameworkBranch: string | null;
    frameworkCommitTs: string | null;
    frameworkStamp: string | null;
    runtimeIdentity: Record<string, unknown> | null;
    runtimesInvolved: Array<Record<string, unknown>>;
    traceEvents: Array<Record<string, unknown>> | null;
    agentLineage: {
        source: "trace-events" | "runtime-only" | "missing";
        has_lineage: boolean;
        trace_event_count: number;
        events_with_agent: number;
        missing_agent_events: number;
        total_agents: number;
        root_agent_count: number;
        subagent_count: number;
        max_depth_observed: number | null;
        runtimes: Array<{
            id: string;
            count: number;
        }>;
        agents: Array<{
            agent_id: string | null;
            agent_role: string | null;
            runtime: string | null;
            parent_agent_id: string | null;
            root_agent_id: string | null;
            depth: number | null;
            model_profile: string | null;
            resolved_model: string | null;
            event_count: number;
            tool_use_count: number;
            skill_invocation_count: number;
            subagent_spawn_count: number;
            file_mutation_count: number;
        }>;
    } | null;
    evalType: string;
    contextMode: string | null;
    timing: ({
        duration_minutes?: number | null;
        phases_completed?: number | null;
        tasks_completed?: number | null;
    } & Record<string, unknown>) | null;
    tokenUsage: ({
        total_tokens?: number | null;
        tool_uses?: number | null;
        note?: string | null;
    } & Record<string, unknown>) | null;
    gitAnalysis: ({
        total_commits?: number | null;
        task_id_commits?: number | null;
        batch_commits?: number | null;
        per_task_discipline?: number | null;
    } & Record<string, unknown>) | null;
    requirementCoverage: ({
        total_criteria?: number | null;
        gate_failed?: boolean | null;
        gate_notes?: string | null;
        fully_met?: number | null;
        partially_met?: number | null;
        not_met?: number | null;
        coverage_ratio?: number | null;
    } & Record<string, unknown>) | null;
    workflowEmergence: ({
        created_task_lists?: boolean | null;
        created_state_tracking?: boolean | null;
        created_architecture_docs?: boolean | null;
        created_reusable_skills?: boolean | null;
        emergence_score?: number | null;
    } & Record<string, unknown>) | null;
    planningQuality: ({
        phases_planned?: number | null;
        tasks_planned?: number | null;
        tasks_completed?: number | null;
        decisions_captured?: number | null;
    } & Record<string, unknown>) | null;
    derived?: {
        divergence_score: number | null;
        plan_adherence_delta: number | null;
        produced_artifact_density: number | null;
        tool_use_mix: Record<string, number> | null;
        skill_to_tool_ratio: number | null;
        subagent_utilization: number | null;
        total_commits: number | null;
        commit_discipline: number | null;
    };
    scores: EvalScores;
    humanReview: ({
        score?: number | null;
        notes?: string | null;
        reviewed_by?: string | null;
        reviewed_at?: string | null;
    } & Record<string, unknown>) | null;
    humanReviewNormalized: {
        rubric_version: string;
        dimensions: Record<string, {
            score: number | null;
            notes: string | null;
        }>;
        aggregate_score: number | null;
        notes: string | null;
        reviewed_by: string | null;
        reviewed_at: string | null;
        is_legacy: boolean;
        is_empty: boolean;
    };
    requirementsDoc: {
        filename: string;
        path: string;
        content: string;
        format: 'xml' | 'md';
    } | null;
    topSkill: {
        filename: string;
        content: string | null;
        bytes: number;
        total_skills: number;
    } | null;
    skillAccuracyBreakdown: {
        expected_triggers: Array<{
            skill: string;
            when?: string;
            triggered: boolean;
            note?: string;
        } & Record<string, unknown>>;
        accuracy: number | null;
    } | null;
    skillsProvenance: {
        installed: Array<{
            name: string;
            source: string;
            type: string;
        }>;
        inherited: Array<{
            name: string;
            source: string;
            type: string;
        }>;
        startSnapshot: string[];
        endSnapshot: string[];
        skillsAuthored: string[];
    } | null;
    /** Task 44-39: per-generation publish lifecycle. Source of truth: MANIFEST.json. */
    status?: "draft" | "published" | "unlisted";
    publishedAt?: string | null;
    publishedBy?: string | null;
}
/**
 * Task 44-40: marketplace index — every published generation across all
 * projects/species, plus a derived species-index for the species browse view.
 */
export interface MarketplaceGeneration {
    id: string;
    project: string;
    species: string | null;
    version: string;
    status: "published";
    publishedAt: string | null;
    publishedBy: string | null;
    playableUrl: string;
    score: number | null;
    date: string | null;
    contextFramework: string | null;
}
export interface MarketplaceSpecies {
    species: string;
    projects: string[];
    publishedCount: number;
    latestPublishedAt: string | null;
}
export interface MarketplaceProject {
    id: string;
    project: string;
    species: string | null;
    name: string;
    description: string | null;
    domain: string | null;
    techStack: string | null;
    contextFramework: string | null;
}
export interface MarketplaceIndex {
    schema: "marketplace-index@1";
    generated_at: string;
    projects: MarketplaceProject[];
    generations: MarketplaceGeneration[];
    species: MarketplaceSpecies[];
}
export interface EvalTemplateAsset {
    project: string;
    species?: string;
    id?: string;
    zipPath: string;
    bytes: number;
}
export interface PlanningZipAsset {
    project: string;
    species?: string;
    id?: string;
    zipPath: string;
    bytes: number;
    files: number;
}
export interface RoundSummary {
    round: string;
    title: string;
    body: string;
}
export interface EvalProjectMeta {
    id: string;
    project?: string;
    species?: string;
    name: string;
    description: string | null;
    /** @deprecated Phase 43 dropped greenfield/brownfield mode framing. */
    evalMode?: string | null;
    /** @deprecated Use contextFramework. Legacy field from gad.json workflow key. */
    workflow: string | null;
    /** Canonical context framework slug per decision gad-179; resolves context_framework or workflow from gad.json. */
    contextFramework: string | null;
    baseline: string | {
        project?: string;
        species?: string;
        version?: string;
        source?: string;
    } | null;
    constraints: Record<string, unknown> | null;
    scoringWeights: Record<string, number> | null;
    humanReviewRubric: {
        version: string;
        dimensions: Array<{
            key: string;
            label: string;
            weight: number;
            description: string;
        }>;
    } | null;
    domain: string | null;
    techStack: string | null;
    buildRequirement: string | null;
    published?: boolean;
}
export interface ProducedArtifacts {
    skillFiles: Array<{
        name: string;
        bytes: number;
        content?: string | null;
        file?: string | null;
    }>;
    agentFiles: Array<{
        name: string;
        bytes: number;
    }>;
    planningFiles: Array<{
        name: string;
        bytes: number;
    }>;
    workflowNotes: Array<{
        name: string;
        bytes: number;
    }>;
}
export declare const EVAL_RUNS: EvalRunRecord[];
export declare const EVAL_TEMPLATES: EvalTemplateAsset[];
export declare const PLANNING_ZIPS: PlanningZipAsset[];
export declare const GAD_PACK_TEMPLATE: {
    zipPath: string;
    bytes: number;
};
export declare const ROUND_SUMMARIES: RoundSummary[];
export declare const EVAL_PROJECTS: EvalProjectMeta[];
export declare const PRODUCED_ARTIFACTS: Record<string, ProducedArtifacts>;
export declare const PLAYABLE_INDEX: Record<string, string>;
export declare const MARKETPLACE_INDEX: MarketplaceIndex;
export interface OpenQuestion {
    id: string;
    title: string;
    category: string;
    status: string;
    priority: string;
    context: string;
    related_decisions: string[];
    related_requirements: string[];
    opened_on: string;
    resolved_on: string | null;
    resolution: string | null;
}
export interface BugRecord {
    id: string;
    title: string;
    project: string;
    version: string;
    observed_on: string;
    severity: string;
    status: string;
    description: string;
    expected: string;
    reproduction: string;
    related_requirement?: string;
    related_runs?: Array<{
        project: string;
        version: string;
    }>;
}
export declare const OPEN_QUESTIONS: OpenQuestion[];
export declare const OPEN_QUESTIONS_UPDATED: string | null;
export declare const BUGS: BugRecord[];
export declare const BUGS_UPDATED: string | null;
export interface GlossaryTerm {
    id: string;
    term: string;
    aliases: string[];
    category: string;
    short: string;
    full: string;
    related_decisions: string[];
    related_terms: string[];
}
export declare const GLOSSARY: GlossaryTerm[];
export declare const GLOSSARY_UPDATED: string | null;
export interface DecisionRecord {
    id: string;
    title: string;
    summary: string;
    impact: string;
}
/**
 * Every decision in .planning/DECISIONS.xml parsed in full. Source of truth
 * for the /decisions page and for <Ref id="gad-XX" /> cross-linking.
 */
export declare const ALL_DECISIONS: DecisionRecord[];
export interface TaskRecord {
    id: string;
    phaseId: string;
    status: string;
    agentId: string | null;
    skill: string | null;
    type: string | null;
    goal: string;
    keywords: string[];
    depends: string[];
}
/**
 * Every task in .planning/TASK-REGISTRY.xml. Feeds /planning (tasks tab) + Ref resolution.
 */
export declare const ALL_TASKS: TaskRecord[];
export interface PhaseRecord {
    id: string;
    title: string;
    status: string;
    goal: string;
    outcome: string | null;
}
/**
 * Every phase in .planning/ROADMAP.xml. Feeds /planning (phases tab) + Ref resolution.
 */
export declare const ALL_PHASES: PhaseRecord[];
export interface SearchEntry {
    id: string;
    title: string;
    kind: "decision" | "task" | "phase" | "glossary" | "question" | "bug" | "skill" | "agent" | "command";
    href: string;
    body: string;
}
/**
 * Flat search index over every structured entry on the site. Body is
 * lowercased at prebuild so the client matcher only does substring checks.
 */
export declare const SEARCH_INDEX: SearchEntry[];
export interface TaskPressureRecord {
    /** Count of <requirement> elements (including inside <addendum>) */
    R: number;
    /** Count of <gate> elements */
    G: number;
    /** Count of amends attribute cross-cuts */
    C: number;
    /** Word count of the requirements text body */
    W: number;
    /** Raw: R + 2*G + C */
    raw: number;
    /** Normalized 0-1 via log2(raw+1) / log2(MAX_EXPECTED+1), MAX_EXPECTED=64 */
    score: number;
}
/**
 * Programmatic task_pressure per requirements version, computed from
 * REQUIREMENTS.xml structure at prebuild. Decision gad-79. Distinct from
 * "game_pressure" which is the in-game player-experience concept. Do not
 * conflate.
 */
export declare const TASK_PRESSURE: Record<string, TaskPressureRecord>;
/**
 * Aggregated skill trigger counts across all generations in a project's brood.
 * Keyed by project id, value is `{ [catalogSkillId]: invocationCount }`.
 * Built from TRACE.json `skill_triggers` arrays across every species and version.
 */
export declare const BROOD_SKILL_AGGREGATION: Record<string, Record<string, number>>;
export declare const WORKFLOW_LABELS: Record<Workflow, string>;
export declare const WORKFLOW_DESCRIPTIONS: Record<Workflow, string>;
//# sourceMappingURL=eval-data.generated.d.ts.map