import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

export function pickWorkedExamples(): EvalRunRecord[] {
  const v8 = EVAL_RUNS.find((r) => r.project === "escape-the-dungeon" && r.version === "v8");
  const barev3 = EVAL_RUNS.find(
    (r) => r.project === "escape-the-dungeon-bare" && r.version === "v3"
  );
  return [v8, barev3].filter((x): x is NonNullable<typeof x> => x != null);
}

export const DATA_STAGES = [
  {
    stage: "1",
    title: "Raw artifacts",
    body:
      "Every eval run produces a TRACE.json sidecar, a session.jsonl (Claude Code), a git log with per-task commits, and a dist/ build. Phase 25 adds .trace-events.jsonl for hook-captured tool/skill/subagent events. These are the primary sources — nothing is ever recomputed from anything upstream.",
    examples: "TRACE.json · session.jsonl · git log · dist/",
  },
  {
    stage: "2",
    title: "Structured records",
    body:
      "The prebuild script reads raw artifacts and emits typed records: EvalRunRecord, CatalogSkill, RequirementsVersion, PlanningState, ProducedArtifacts. Schema versioned so old runs parse cleanly alongside new ones. This is what the site consumes — no client-side parsing.",
    examples: "lib/eval-data.generated.ts · lib/catalog.generated.ts",
  },
  {
    stage: "3",
    title: "Derived metrics",
    body:
      "Computed from structured records: composite scores, divergence (composite vs human review), commit rhythm, plan-adherence delta, tool-use mix (phase 25+), skill-to-tool ratio, produced artifact density. Each derived number has a formula that's traceable back to its inputs — no magic aggregates.",
    examples: "scores.composite · divergence_score · plan_adherence_delta",
  },
  {
    stage: "4",
    title: "Insights + visualizations",
    body:
      "Cross-run queries answer specific research questions. Charts shape data around the question, not the data shape. Phase 27 adds /insights with curated query cards and gad eval query for custom drilling. Every chart's caption is the question it answers — the number is just evidence.",
    examples: "freedom hypothesis scatter · rubric radar · insight cards",
  },
];

export const AGENT_RUNTIMES = [
  {
    agent: "Claude Code",
    hook: "PreToolUse / PostToolUse hooks via settings.json",
    supported: true,
    notes:
      "First-class support. Hooks run before and after every tool call; session.jsonl captures the full invocation stream. Phase 25 writes a hook handler that emits trace v4 events directly.",
  },
  {
    agent: "Aider",
    hook: "Python callbacks + chat history export",
    supported: true,
    notes:
      "Supported via converter. Python API exposes on_message / on_tool_call style callbacks; the existing chat history file is parseable for after-the-fact conversion. Future sub-phase.",
  },
  {
    agent: "Continue.dev",
    hook: "VS Code extension API (onToolCall, onChatUpdate)",
    supported: true,
    notes:
      "Supported via converter. Extension hosts expose tool-call events; we'd ship a small extension-side emitter that writes trace v4 to disk. Future sub-phase.",
  },
  {
    agent: "OpenAI Codex CLI",
    hook: "Structured stream output (Running/Ran prefixes)",
    supported: true,
    notes:
      "Supported via stream parser. Codex's terminal output format is line-delimited with recognisable prefixes (Running ..., • Ran ..., └ <output>). Lossier than hooks because reasoning text interleaves with tool calls and rate limits can truncate. Future sub-phase.",
  },
  {
    agent: "Cursor",
    hook: "Closed-source, no public hook API",
    supported: false,
    notes:
      "No way to trace from inside the editor. The only access is through the chat panel which has no tool-call visibility. Not supported until Cursor exposes a hook runtime.",
  },
  {
    agent: "Vanilla ChatGPT / Claude.ai web",
    hook: "None",
    supported: false,
    notes:
      "Web interfaces have no tool access and no extension points. Fundamentally the wrong shape of tool for the kind of work we're evaluating.",
  },
] as const;

export const METHODOLOGY_TEMPLATE_ROWS: [string, string, string, string, string, string][] = [
  ["AGENTS.md", "✓", "✓", "✓", "✓", "✓"],
  ["REQUIREMENTS.xml", "✓", "✓", "✓", "✓", "✓"],
  [".planning/ROADMAP.xml", "—", "✓", "✓", "—", "✓"],
  [".planning/TASK-REGISTRY.xml", "—", "✓", "✓", "—", "✓"],
  [".planning/DECISIONS.xml", "—", "✓", "✓", "—", "✓"],
  [".planning/STATE.xml", "—", "✓", "✓", "—", "✓"],
  ["skills/ (bootstrap: 2)", "✓", "✓", "—", "—", "—"],
  ["skills/ (GAD: 10)", "—", "—", "✓", "—", "✓"],
  ["skills/ (inherited: 6)", "—", "—", "—", "✓", "✓"],
  ["GAD CLI available", "—", "—", "✓", "—", "✓"],
  ["Total skills", "2", "2", "10", "6", "16"],
];
