export type PlanningRuntimeCount = {
  runtime: string;
  count?: number;
  sessions?: number;
};

export type PlanningDepthCount = {
  depth: number;
  count: number;
};

export type PlanningActiveAgentLane = {
  agent_id: string;
  agent_role: string;
  runtime: string;
  depth: number;
  parent_agent_id: string | null;
  root_agent_id: string | null;
  model_profile: string | null;
  resolved_model: string | null;
  tasks: string[];
  last_seen_at: string | null;
  status: string;
};

export type PlanningPhasePressure = {
  phase: string;
  tasks_total: number;
  tasks_done: number;
  crosscuts: number;
  pressure_score: number;
  high_pressure: boolean;
};

export type PlanningEvalProjectBreakdown = {
  project: string;
  runs: number;
  reviewed_runs: number;
  total_tokens: number;
  tracked_token_runs: number;
  total_tool_uses: number;
  latest_version?: string;
};

/** Shape of `self-eval.json` latest block consumed by the planning System tab. */
export type PlanningSelfEvalLatest = {
  totals: {
    events: number;
    sessions: number;
    gad_cli_calls: number;
  };
  runtime_distribution?: PlanningRuntimeCount[];
  runtime_sessions?: PlanningRuntimeCount[];
  framework_overhead: {
    ratio: number;
  };
  framework_compliance: {
    score: number;
    completed_tasks: number;
    with_skill: number;
    with_agent: number;
    with_type: number;
    fully_attributed: number;
  };
  hydration: {
    snapshot_count: number;
    estimated_snapshot_tokens: number;
    total_project_tokens: number;
    overhead_ratio: number;
    projects: Array<{
      project: string;
      count: number;
      estimated_tokens_per_snapshot: number;
      estimated_total_tokens: number;
    }>;
  };
  phases_pressure: PlanningPhasePressure[];
  evals?: {
    runs: number;
    projects: number;
    reviewed_runs: number;
    latest_run_date: string | null;
    tokens: {
      total: number;
      tracked_runs: number;
      missing_runs: number;
      avg_per_tracked_run: number | null;
    };
    tool_uses: {
      total: number;
      tracked_runs: number;
    };
    runtime_distribution: PlanningRuntimeCount[];
    project_breakdown: PlanningEvalProjectBreakdown[];
  };
  project_tokens?: {
    exact_eval_tokens: number;
    estimated_live_input_tokens: number;
    estimated_live_output_tokens: number;
    estimated_live_total_tokens: number;
    combined_total_tokens: number;
    trace_files: number;
    trace_events: number;
    runtime_distribution: PlanningRuntimeCount[];
    sources: Array<{
      path: string;
      events: number;
      estimated_input_tokens: number;
      estimated_output_tokens: number;
      estimated_total_tokens: number;
    }>;
  };
  active_assignments?: {
    total_active_agents: number;
    total_stale_agents: number;
    total_claimed_tasks: number;
    runtime_distribution: PlanningRuntimeCount[];
    depth_distribution: PlanningDepthCount[];
    active_agents: PlanningActiveAgentLane[];
    stale_agents: PlanningActiveAgentLane[];
  };
};
