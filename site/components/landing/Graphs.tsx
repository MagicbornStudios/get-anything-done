import Link from "next/link";
import { EVAL_RUNS, WORKFLOW_LABELS, type EvalRunRecord, type Workflow } from "@/lib/eval-data";

// Pure-SVG charts, server-rendered. No chart library. Two charts:
// 1. Composite vs Human Review scatter — grouped by workflow — shows the
//    freedom hypothesis: dots in the "low composite but high human review"
//    quadrant, i.e. runs that process metrics called mediocre but reviewers
//    called good (or vice versa).
// 2. Rounds timeline — bar chart of composite scores by run, coloured by
//    workflow, ordered roughly chronologically.

const WORKFLOW_COLOUR: Record<Workflow, string> = {
  gad: "#38bdf8",      // sky-400
  bare: "#34d399",     // emerald-400
  emergent: "#fbbf24", // amber-400
};

function runsWithScores(): EvalRunRecord[] {
  return EVAL_RUNS.filter(
    (r) =>
      r.scores.composite != null &&
      r.humanReview?.score != null
  );
}

function Scatter() {
  const data = runsWithScores();
  const width = 640;
  const height = 380;
  const padding = { top: 20, right: 20, bottom: 44, left: 54 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const xScale = (x: number) => padding.left + x * plotW;
  const yScale = (y: number) => padding.top + (1 - y) * plotH;

  // Gridlines at 0.25 intervals
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Scatter plot: composite score vs human review">
      {/* Quadrant shading — "process lies" zone (bottom-right: high composite, low human) */}
      <rect
        x={xScale(0.5)}
        y={yScale(0.5)}
        width={plotW / 2}
        height={plotH / 2}
        fill="rgba(239, 68, 68, 0.08)"
      />
      {/* "Process undersells" zone (top-left: low composite, high human) */}
      <rect
        x={padding.left}
        y={padding.top}
        width={plotW / 2}
        height={plotH / 2}
        fill="rgba(52, 211, 153, 0.08)"
      />

      {/* Grid */}
      {ticks.map((t) => (
        <g key={`x-${t}`}>
          <line
            x1={xScale(t)}
            y1={padding.top}
            x2={xScale(t)}
            y2={padding.top + plotH}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
          <text
            x={xScale(t)}
            y={padding.top + plotH + 20}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.55)"
            fontFamily="monospace"
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <g key={`y-${t}`}>
          <line
            x1={padding.left}
            y1={yScale(t)}
            x2={padding.left + plotW}
            y2={yScale(t)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
          <text
            x={padding.left - 10}
            y={yScale(t) + 3}
            textAnchor="end"
            fontSize="10"
            fill="rgba(255,255,255,0.55)"
            fontFamily="monospace"
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top + plotH}
        x2={padding.left + plotW}
        y2={padding.top + plotH}
        stroke="rgba(255,255,255,0.2)"
      />
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + plotH}
        stroke="rgba(255,255,255,0.2)"
      />

      {/* Diagonal reference (x=y) — runs landing on this line have composite matching human review */}
      <line
        x1={xScale(0)}
        y1={yScale(0)}
        x2={xScale(1)}
        y2={yScale(1)}
        stroke="rgba(224, 179, 120, 0.3)"
        strokeDasharray="4 4"
      />

      {/* Points */}
      {data.map((run) => {
        const x = run.scores.composite ?? 0;
        const y = run.humanReview?.score ?? 0;
        const colour = WORKFLOW_COLOUR[run.workflow];
        return (
          <g key={`${run.project}-${run.version}`}>
            <circle
              cx={xScale(x)}
              cy={yScale(y)}
              r={6}
              fill={colour}
              fillOpacity={0.4}
              stroke={colour}
              strokeWidth={1.5}
            />
            <text
              x={xScale(x) + 9}
              y={yScale(y) + 3}
              fontSize="9"
              fill="rgba(255,255,255,0.65)"
              fontFamily="monospace"
            >
              {run.version}
            </text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text
        x={padding.left + plotW / 2}
        y={height - 8}
        textAnchor="middle"
        fontSize="11"
        fill="rgba(255,255,255,0.7)"
      >
        composite score →
      </text>
      <text
        x={16}
        y={padding.top + plotH / 2}
        textAnchor="middle"
        fontSize="11"
        fill="rgba(255,255,255,0.7)"
        transform={`rotate(-90, 16, ${padding.top + plotH / 2})`}
      >
        human review ↑
      </text>
    </svg>
  );
}

function Bars() {
  const data = runsWithScores().sort((a, b) => {
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
  const width = 720;
  const barHeight = 26;
  const rowGap = 10;
  const padding = { top: 10, right: 80, bottom: 24, left: 220 };
  const plotW = width - padding.left - padding.right;
  const height = padding.top + padding.bottom + data.length * (barHeight + rowGap);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Per-run composite score bar chart">
      {/* Axis */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="rgba(255,255,255,0.2)"
      />
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line
            x1={padding.left + t * plotW}
            y1={padding.top}
            x2={padding.left + t * plotW}
            y2={height - padding.bottom}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
          <text
            x={padding.left + t * plotW}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.55)"
            fontFamily="monospace"
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}

      {data.map((run, idx) => {
        const composite = run.scores.composite ?? 0;
        const human = run.humanReview?.score ?? 0;
        const y = padding.top + idx * (barHeight + rowGap);
        const label = `${run.project.replace("escape-the-dungeon", "etd")}/${run.version}`;
        const colour = WORKFLOW_COLOUR[run.workflow];
        return (
          <g key={`${run.project}-${run.version}`}>
            <text
              x={padding.left - 10}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              fontSize="10"
              fill="rgba(255,255,255,0.75)"
              fontFamily="monospace"
            >
              {label}
            </text>
            {/* Composite bar (filled) */}
            <rect
              x={padding.left}
              y={y + 2}
              width={composite * plotW}
              height={barHeight / 2 - 2}
              fill={colour}
              fillOpacity={0.5}
            />
            {/* Human review bar (outlined) */}
            <rect
              x={padding.left}
              y={y + barHeight / 2 + 1}
              width={human * plotW}
              height={barHeight / 2 - 2}
              fill="none"
              stroke={colour}
              strokeWidth={1.5}
            />
            <text
              x={padding.left + plotW + 8}
              y={y + barHeight / 2 - 1}
              fontSize="9"
              fill="rgba(255,255,255,0.75)"
              fontFamily="monospace"
            >
              {composite.toFixed(2)}
            </text>
            <text
              x={padding.left + plotW + 8}
              y={y + barHeight / 2 + 11}
              fontSize="9"
              fill="rgba(255,255,255,0.55)"
              fontFamily="monospace"
            >
              {human.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Graphs() {
  return (
    <section id="graphs" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Graphs</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          The freedom hypothesis, <span className="gradient-text">plotted.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          The scatter plots every scored run on composite vs human review axes. The diagonal
          dashed line is where process metrics agree with reviewers. The red quadrant (bottom-right)
          is where composite is generous but humans say otherwise — decision gad-29&apos;s whole
          reason for weighting human review at 30%. The bar chart is the same data ordered by
          project + version so you can see the arc across rounds.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border/70 bg-background/40 p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                composite × human review
              </h3>
              <div className="flex items-center gap-3 text-[10px]">
                {(["gad", "bare", "emergent"] as Workflow[]).map((wf) => (
                  <span key={wf} className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: WORKFLOW_COLOUR[wf] }}
                    />
                    {WORKFLOW_LABELS[wf]}
                  </span>
                ))}
              </div>
            </div>
            <Scatter />
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              Red quadrant = process metrics overstated the run. Green quadrant = process metrics
              undersold it. Runs on or near the diagonal = metrics and reviewers agreed.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/40 p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                per-run composite + human
              </h3>
              <div className="text-[10px] text-muted-foreground">
                ░ composite · ▭ human (outline)
              </div>
            </div>
            <Bars />
          </div>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Want the full breakdown for any of these? Click through to{" "}
          <Link href="/#results" className="text-accent hover:underline">
            Results
          </Link>{" "}
          for the per-run cards or{" "}
          <Link href="/methodology" className="text-accent hover:underline">
            Methodology
          </Link>{" "}
          for how the composite is computed.
        </p>
      </div>
    </section>
  );
}
