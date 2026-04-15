/**
 * Organic “vein” backdrop for the evolution hero — soft tube strokes + traveling pulse
 * (stroke-dashoffset). Decorative only; `aria-hidden` on the root wrapper in the parent.
 */

const VB = "0 0 1200 720";

const VEINS: { d: string; dur: number; delay: number; tube: number; core: number }[] = [
  {
    d: "M -60 640 C 200 500, 340 400, 520 280 S 820 120, 1260 -40",
    dur: 7.2,
    delay: 0,
    tube: 18,
    core: 2.4,
  },
  {
    d: "M 120 720 C 300 540, 460 420, 640 300 S 920 140, 1240 20",
    dur: 9.5,
    delay: -2.1,
    tube: 22,
    core: 2.1,
  },
  {
    d: "M -80 460 C 160 380, 320 300, 520 220 S 860 80, 1180 -30",
    dur: 6.4,
    delay: -1.4,
    tube: 14,
    core: 1.9,
  },
  {
    d: "M 280 720 C 420 520, 560 400, 720 280 S 960 120, 1220 40",
    dur: 8.8,
    delay: -3.6,
    tube: 20,
    core: 2.2,
  },
  {
    d: "M 40 560 Q 260 420, 480 340 T 920 140 T 1220 -20",
    dur: 10.2,
    delay: -4.8,
    tube: 12,
    core: 1.6,
  },
];

export function EvolutionVeinBackdrop() {
  return (
    <svg
      className="evolution-vein-svg absolute inset-0 h-full w-full"
      viewBox={VB}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="evolution-vein-fade" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="var(--background)" stopOpacity="0.94" />
          <stop offset="38%" stopColor="var(--background)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft tube bodies (wide strokes, gentle opacity pulse) */}
      <g className="evolution-vein-tubes">
        {VEINS.map((v, i) => (
          <path
            key={`tube-${i}`}
            d={v.d}
            pathLength={1}
            fill="none"
            stroke="var(--color-accent)"
            strokeLinecap="round"
            strokeWidth={v.tube}
            className="evolution-vein-tube-pulse"
            style={{
              animationDelay: `${v.delay}s`,
              animationDuration: `${v.dur * 1.35}s`,
            }}
          />
        ))}
      </g>

      {/* Bright core + traveling capsule along the tube */}
      <g className="evolution-vein-cores">
        {VEINS.map((v, i) => (
          <path
            key={`core-${i}`}
            d={v.d}
            pathLength={1}
            fill="none"
            stroke="var(--color-accent)"
            strokeLinecap="round"
            strokeWidth={v.core}
            strokeDasharray="0.09 0.91"
            strokeDashoffset={0}
            className="evolution-vein-flow"
            style={{
              animationDuration: `${v.dur}s`,
              animationDelay: `${v.delay}s`,
            }}
          />
        ))}
      </g>

      {/* Wider bloom locked to the same dash — reads like the pulse filling the vein */}
      <g className="evolution-vein-blooms" style={{ opacity: 0.42 }}>
        {VEINS.map((v, i) => (
          <path
            key={`bloom-${i}`}
            d={v.d}
            pathLength={1}
            fill="none"
            stroke="var(--color-accent)"
            strokeLinecap="round"
            strokeWidth={v.core * 4.5}
            strokeDasharray="0.11 0.89"
            strokeDashoffset={0}
            className="evolution-vein-flow evolution-vein-flow--bloom"
            style={{
              animationDuration: `${v.dur}s`,
              animationDelay: `${v.delay}s`,
            }}
          />
        ))}
      </g>

      <rect width="1200" height="720" fill="url(#evolution-vein-fade)" />
    </svg>
  );
}
