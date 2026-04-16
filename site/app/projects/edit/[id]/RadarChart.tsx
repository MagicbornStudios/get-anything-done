"use client";

import { useMemo } from "react";
import { SiteSection } from "@/components/site";

export type RadarSeries = {
  label: string;
  color: string;
  values: number[]; // 0-1 per axis, same length as axes
};

const CHART_SIZE = 200;
const CENTER = CHART_SIZE / 2;
const RADIUS = 80;
const RINGS = 4;

function polarToCart(angle: number, r: number): [number, number] {
  // Start from top (- PI/2)
  const a = angle - Math.PI / 2;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

export function RadarChart({
  axes,
  series,
  title,
}: {
  axes: string[];
  series: RadarSeries[];
  title?: string;
}) {
  const n = axes.length;
  const angleStep = (2 * Math.PI) / n;

  const gridRings = useMemo(() => {
    const rings: string[] = [];
    for (let ring = 1; ring <= RINGS; ring++) {
      const r = (RADIUS / RINGS) * ring;
      const pts = Array.from({ length: n }, (_, i) => polarToCart(i * angleStep, r));
      rings.push(pts.map((p) => `${p[0]},${p[1]}`).join(" "));
    }
    return rings;
  }, [n, angleStep]);

  const spokes = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const [x, y] = polarToCart(i * angleStep, RADIUS);
        return { x1: CENTER, y1: CENTER, x2: x, y2: y };
      }),
    [n, angleStep],
  );

  const labels = useMemo(
    () =>
      axes.map((label, i) => {
        const [x, y] = polarToCart(i * angleStep, RADIUS + 16);
        return { label, x, y };
      }),
    [axes, angleStep],
  );

  const seriesPaths = useMemo(
    () =>
      series.map((s) => {
        const pts = s.values.map((v, i) =>
          polarToCart(i * angleStep, v * RADIUS),
        );
        return {
          ...s,
          d: pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") + " Z",
        };
      }),
    [series, angleStep],
  );

  if (n < 3) return null;

  return (
    <SiteSection
      cid="project-editor-radar-chart-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="px-3 py-2">
        {title && (
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {title}
          </h3>
        )}
        <svg
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
          className="w-full max-w-[240px] mx-auto"
        >
          {/* Grid rings */}
          {gridRings.map((pts, i) => (
            <polygon
              key={i}
              points={pts}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={0.5}
            />
          ))}

          {/* Spokes */}
          {spokes.map((s, i) => (
            <line
              key={i}
              {...s}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={0.5}
            />
          ))}

          {/* Series polygons */}
          {seriesPaths.map((s, i) => (
            <g key={i}>
              <path
                d={s.d}
                fill={s.color}
                fillOpacity={0.15}
                stroke={s.color}
                strokeWidth={1.5}
              />
            </g>
          ))}

          {/* Axis labels */}
          {labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[6px]"
            >
              {l.label}
            </text>
          ))}
        </svg>

        {/* Legend */}
        {series.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {series.map((s) => (
              <div key={s.label} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteSection>
  );
}
