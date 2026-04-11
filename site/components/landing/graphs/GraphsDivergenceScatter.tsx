"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { WORKFLOW_LABELS, type Workflow } from "@/lib/eval-data";
import {
  GRAPHS_WORKFLOW_ORDER,
  WORKFLOW_COLOR,
  type GraphsScatterPoint,
} from "@/components/landing/graphs/graphs-shared";

type Props = {
  scatterData: GraphsScatterPoint[];
};

export function GraphsDivergenceScatter({ scatterData }: Props) {
  return (
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
            {GRAPHS_WORKFLOW_ORDER.map((wf) => {
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
  );
}
