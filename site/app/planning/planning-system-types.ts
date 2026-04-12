export type PlanningRuntimeCount = {
  runtime: string;
  count?: number;
  sessions?: number;
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
  loop_compliance: {
    score: number;
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
};
