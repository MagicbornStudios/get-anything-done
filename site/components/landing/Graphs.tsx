"use client";

import Link from "next/link";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { EVAL_RUNS, WORKFLOW_LABELS, isInterrupted, type EvalRunRecord, type Workflow } from "@/lib/eval-data";

/**
 * Interactive graphs section on the landing page.
 * Two charts:
 * 1. Divergence scatter (composite vs human review) — shows ALL hypotheses,
 *    color-coded by workflow. Points above the diagonal = human rates higher
 *    than automated composite. Points below = composite inflated.
 * 2. Per-run bar chart — all scored runs ordered by score, colored by workflow.
 *
 * Both recharts-based for interactivity (hover tooltips, click-through).
 */

const WORKFLOW_COLOR: Record<Workflow, string> = {
  gad: "#38bdf8",
  bare: "#34d399",
  emergent: "#fbbf24",
};

function runsWithScores(): Array<{
  name: string;
  composite: number;
  human: number;
  workflow: Workflow;
  project: string;
  version: string;
}> {
  return EVAL_RUNS.filter(
    (r) => !isInterrupted(r) && r.scores.composite != null && r.humanReview?.score != null
  ).map((r) => ({
    name: `${r.project.replace("escape-the-dungeon", "etd")}/${r.version}`,
    composite: r.scores.composite!,
    human: r.humanReview!.score as number,
    workflow: r.workflow,
    project: r.project,
    version: r.version,
  }));
}

function barData(): Array<{
  name: string;
  score: number;
  workflow: Workflow;
}> {
  return EVAL_RUNS.filter(
    (r) => !isInterrupted(r) && (r.humanReviewNormalized?.aggregate_score != null || r.humanReview?.score != null)
  )
    .map((r) => ({
      name: `${r.project.replace("escape-the-dungeon", "etd").replace("-", "\n")}/${r.version}`,
      score: r.humanReviewNormalized?.aggregate_score ?? r.humanReview?.score ?? 0,
      workflow: r.workflow,
    }))
    .sort((a, b) => b.score - a.score);
}

export default function Graphs() {
  const scatterData = runsWithScores();
  const bars = barData();

  if (scatterData.length === 0 && bars.length === 0) return null;

  return (
    <section id="graphs" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Graphs</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          All hypotheses, <span className="gradient-text">plotted.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Interactive charts covering every scored run across all three workflow
          conditions (GAD, bare, emergent). Hover for details. The{" "}
          <a href="#tracks" className="text-accent underline decoration-dotted">
            hypothesis tracks chart above
          </a>{" "}
          shows the cross-round trajectory; these show the per-run data points.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Divergence scatter */}
          <div className="rounded-2xl border border-border/70 bg-card/30 p-5">
            <h3 className="mb-1 text-base font-semibold text-foreground">
              Composite vs human review
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Points above the diagonal: human rates higher than automated
              composite. The freedom hypothesis shows bare consistently above
              the line while GAD clusters below.
            </p>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <XAxis
                    type="number"
                    dataKey="composite"
                    name="Composite"
                    domain={[0, 1]}
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                    label={{
                      value: "composite",
                      position: "bottom",
                      style: { fontSize: 10, fill: "rgba(255,255,255,0.4)" },
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="human"
                    name="Human"
                    domain={[0, 1]}
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                    label={{
                      value: "human",
                      angle: -90,
                      position: "insideLeft",
                      offset: 20,
                      style: { fontSize: 10, fill: "rgba(255,255,255,0.4)" },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    formatter={(value: unknown) =>
                      typeof value === "number" ? value.toFixed(3) : String(value)
                    }
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload;
                      return item ? `${item.name} (${WORKFLOW_LABELS[item.workflow as Workflow]})` : "";
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    iconSize={8}
                  />
                  {(["gad", "bare", "emergent"] as Workflow[]).map((wf) => {
                    const points = scatterData.filter((d) => d.workflow === wf);
                    if (points.length === 0) return null;
                    return (
                      <Scatter
                        key={wf}
                        name={WORKFLOW_LABELS[wf]}
                        data={points}
                        fill={WORKFLOW_COLOR[wf]}
                        fillOpacity={0.8}
                      />
                    );
                  })}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* All runs bar chart */}
          <div className="rounded-2xl border border-border/70 bg-card/30 p-5">
            <h3 className="mb-1 text-base font-semibold text-foreground">
              All scored runs — human review
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Every run with a human review score, ranked highest to lowest.
              Color = workflow condition.
            </p>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bars}
                  margin={{ top: 10, right: 10, bottom: 30, left: -10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 8, fill: "rgba(255,255,255,0.5)" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    formatter={(value: unknown) =>
                      typeof value === "number" ? [value.toFixed(3), "Human review"] : String(value)
                    }
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {bars.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={WORKFLOW_COLOR[entry.workflow] ?? "#888"}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {(["gad", "bare", "emergent"] as Workflow[]).map((wf) => (
                <span key={wf} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: WORKFLOW_COLOR[wf] }}
                  />
                  {WORKFLOW_LABELS[wf]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          <strong className="text-foreground">Data provenance:</strong> scatter
          reads <code className="rounded bg-background/60 px-1 py-0.5">scores.composite</code>{" "}
          and <code className="rounded bg-background/60 px-1 py-0.5">humanReview.score</code>{" "}
          from TRACE.json per run. Bar chart reads{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">humanReviewNormalized.aggregate_score</code>.
          Rate-limited and API-interrupted runs excluded per gad-63 + gad-64.
          See{" "}
          <Link href="/data" className="text-accent underline decoration-dotted">
            /data
          </Link>{" "}
          for the full provenance index.
        </p>
      </div>
    </section>
  );
}
