import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

export function pickWorkedExamples(): EvalRunRecord[] {
  const v8 = EVAL_RUNS.find((r) => r.project === "escape-the-dungeon" && r.version === "v8");
  const barev3 = EVAL_RUNS.find(
    (r) => r.project === "escape-the-dungeon-bare" && r.version === "v3"
  );
  return [v8, barev3].filter((x): x is NonNullable<typeof x> => x != null);
}

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
