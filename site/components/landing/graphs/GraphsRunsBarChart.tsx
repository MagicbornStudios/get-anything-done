"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { WORKFLOW_LABELS } from "@/lib/eval-data";
import {
  GRAPHS_WORKFLOW_ORDER,
  WORKFLOW_COLOR,
  type GraphsBarRow,
} from "@/components/landing/graphs/graphs-shared";

type Props = {
  bars: GraphsBarRow[];
};

export function GraphsRunsBarChart({ bars }: Props) {
  return (
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
        {GRAPHS_WORKFLOW_ORDER.map((wf) => (
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
  );
}
