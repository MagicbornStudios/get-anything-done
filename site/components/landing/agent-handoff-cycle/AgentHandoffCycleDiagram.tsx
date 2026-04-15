import { CLAUDE_CODE_HANDOFF_IMG } from "@/components/landing/agent-handoff-cycle/agent-handoff-cycle-constants";

const STEPS: { id: string; title: string; short: string; isAgent?: boolean }[] = [
  { id: "browse", title: "Browse site", short: "Dev IDs · greppable cid" },
  { id: "panel", title: "Visual context", short: "Hover band → quick prompt" },
  { id: "speech", title: "Capture", short: "Speech + CRUD verbs" },
  { id: "clipboard", title: "Clipboard", short: "Structured handoff" },
  { id: "agent", title: "Coding agent", short: "Claude Code, Cursor, Codex…", isAgent: true },
  { id: "ship", title: "Ship & return", short: "Reload · next band" },
];

const N = STEPS.length;
/** Ellipse in viewBox 0..1000 x 0..720 — node i at angle from top, clockwise */
function nodeCenter(i: number): { x: number; y: number } {
  const cx = 500;
  const cy = 340;
  const rx = 400;
  const ry = 248;
  const ang = (-Math.PI / 2 + (i / N) * 2 * Math.PI) as number;
  return { x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) };
}

/** Arc path along ellipse from node i to i+1 (same winding as nodes) */
function arcSegment(i: number): string {
  const a = nodeCenter(i);
  const b = nodeCenter((i + 1) % N);
  const large = 0;
  const sweep = 1;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A 400 248 0 ${large} ${sweep} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/**
 * Cyclical handoff diagram — SVG flow + HTML nodes; terminal screenshot sits inside the agent step.
 */
export function AgentHandoffCycleDiagram() {
  return (
    <div
      className="mb-12 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/50 via-card/25 to-muted/20 shadow-inner shadow-black/20"
      role="region"
      aria-label="Cycle from browsing the site through visual context and clipboard to a coding agent and back"
    >
      <div className="border-b border-border/50 bg-gradient-to-r from-accent/10 via-transparent to-accent/5 px-4 py-4 text-center md:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handoff cycle</p>
        <p className="mt-1 text-balance text-sm text-muted-foreground">
          Site → context → speech → clipboard → agent → ship — then you point the panel at the next band (
          <code className="rounded bg-background/80 px-1 font-mono text-[10px]">cid</code> /{" "}
          <code className="rounded bg-background/80 px-1 font-mono text-[10px]">data-cid</code>
          ).
        </p>
      </div>

      {/* Mobile: vertical stack with image in agent block */}
      <div className="flex flex-col gap-4 p-4 md:hidden">
        {STEPS.map((step, i) => (
          <div key={step.id}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/15 text-xs font-bold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.short}</p>
                {step.isAgent ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={CLAUDE_CODE_HANDOFF_IMG}
                      alt="Claude Code: paste the handoff from the site and the agent runs it."
                      width={800}
                      height={450}
                      className="h-auto w-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {i < N - 1 ? (
              <div className="ml-[18px] flex h-6 items-center border-l-2 border-dashed border-accent/35 pl-4" aria-hidden />
            ) : (
              <div className="mt-2 flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                <span className="text-accent">↻</span> Loop — refresh the site and repeat.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop / md+: elliptical SVG + overlay nodes */}
      <div className="relative hidden min-h-[min(92vw,720px)] md:block md:min-h-[680px]">
        <svg
          className="absolute inset-0 h-full w-full text-accent"
          viewBox="0 0 1000 720"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id="handoff-flow-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35" />
            </linearGradient>
            <marker
              id="handoff-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" fillOpacity="0.9" />
            </marker>
          </defs>
          {/* faint guide ellipse */}
          <ellipse
            cx="500"
            cy="340"
            rx="400"
            ry="248"
            fill="none"
            stroke="var(--border)"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="6 10"
          />
          {Array.from({ length: N }, (_, i) => (
            <path
              key={`seg-${STEPS[i].id}`}
              d={arcSegment(i)}
              fill="none"
              stroke="url(#handoff-flow-stroke)"
              strokeWidth="2.5"
              markerEnd="url(#handoff-arrow)"
              opacity="0.92"
            />
          ))}
          {/* closing hint: subtle arc from last back toward first */}
          <text
            x="500"
            y="688"
            textAnchor="middle"
            fill="var(--muted-foreground)"
            style={{ fontSize: "11px", fontFamily: "var(--font-sans)" }}
          >
            Rinse · repeat — same loop for every band you target
          </text>
        </svg>

        {/* HTML overlays — positions in % match viewBox 1000×720 */}
        <div className="absolute inset-0">
          {STEPS.map((step, i) => {
            const { x, y } = nodeCenter(i);
            const leftPct = (x / 1000) * 100;
            const topPct = (y / 720) * 100;
            if (step.isAgent) {
              return (
                <div
                  key={step.id}
                  className="absolute z-10 w-[min(92vw,420px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                >
                  <div className="overflow-hidden rounded-2xl border-2 border-accent/50 bg-card shadow-2xl shadow-black/50 ring-1 ring-accent/20">
                    <div className="border-b border-border/60 bg-accent/10 px-3 py-2">
                      <p className="text-center text-[11px] font-bold uppercase tracking-wide text-accent">
                        {i + 1}. {step.title}
                      </p>
                      <p className="text-center text-[10px] text-muted-foreground">{step.short}</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={CLAUDE_CODE_HANDOFF_IMG}
                      alt="Claude Code terminal with pasted handoff from the marketing site."
                      width={840}
                      height={472}
                      className="h-auto w-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              );
            }
            return (
              <div
                key={step.id}
                className="absolute z-[5] w-[min(38vw,200px)] max-w-[200px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                <div className="rounded-xl border border-border/70 bg-card/95 px-2.5 py-2 text-center shadow-md backdrop-blur-sm">
                  <span className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                    {i + 1}
                  </span>
                  <p className="text-[11px] font-semibold leading-tight text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{step.short}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
