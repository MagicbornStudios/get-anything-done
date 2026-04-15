import { Bot, CircleUser, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLAUDE_CODE_HANDOFF_IMG } from "@/components/landing/agent-handoff-cycle/agent-handoff-cycle-constants";

type StepKind = "user" | "automatic" | "agent";

const STEPS: {
  id: string;
  title: string;
  short: string;
  kind: StepKind;
  isAgent?: boolean;
}[] = [
  { id: "browse", title: "Browse site", short: "Dev IDs · greppable cid", kind: "user" },
  {
    id: "panel",
    title: "Visual context",
    short: "Band hover opens Message",
    kind: "automatic",
  },
  { id: "speech", title: "You capture", short: "Speech + CRUD verbs", kind: "user" },
  {
    id: "clipboard",
    title: "Clipboard",
    short: "Handoff assembled for you",
    kind: "automatic",
  },
  { id: "agent", title: "Coding agent", short: "Claude Code, Cursor, Codex…", kind: "agent", isAgent: true },
  { id: "ship", title: "Ship & return", short: "Reload · next band", kind: "user" },
];

const N = STEPS.length;

/** Decorative — mirrors DevIdAgentPromptDialog Message strip (Update / Delete + mic). */
function VisualContextModalMicro({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[9.75rem] overflow-hidden rounded-lg border border-border/80 bg-popover text-left shadow-md",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-center justify-between gap-1 border-b border-border/60 bg-muted/50 px-1.5 py-1">
        <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
          Message
        </span>
        <div className="flex gap-0.5">
          <span className="rounded-sm bg-accent/25 px-1 py-0.5 text-[7px] font-semibold text-accent">
            Update
          </span>
          <span className="rounded-sm bg-muted px-1 py-0.5 text-[7px] font-medium text-muted-foreground">
            Delete
          </span>
        </div>
      </div>
      <div className="space-y-1 p-1.5">
        <div className="h-1.5 w-full rounded-sm bg-muted/70" />
        <div className="h-1.5 w-[88%] rounded-sm bg-muted/50" />
        <div className="flex items-center justify-end pt-0.5">
          <Mic className="size-3.5 text-accent" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function StepAffordance({ kind, dense }: { kind: StepKind; dense?: boolean }) {
  if (kind === "user") {
    return (
      <div className={cn("flex justify-center", dense ? "mb-0.5" : "mb-1.5")} aria-hidden>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/45 bg-accent/10 text-accent"
          title="You"
        >
          <CircleUser className="size-4" strokeWidth={2} />
        </span>
      </div>
    );
  }
  if (kind === "automatic") {
    return (
      <div className={cn("flex justify-center", dense ? "mb-0.5" : "mb-1.5")} title="Visual Context handoff">
        <VisualContextModalMicro className={dense ? "max-w-[8.5rem]" : undefined} />
      </div>
    );
  }
  return (
    <div className={cn("flex justify-center", dense ? "mb-0.5" : "mb-1.5")} aria-hidden>
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/45 bg-accent/10 text-accent"
        title="Coding agent"
      >
        <Bot className="size-4" strokeWidth={2} />
      </span>
    </div>
  );
}

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
 * Cyclical handoff diagram — SVG flow + HTML nodes; terminal screenshot in the agent step.
 * User steps use a user icon; automatic steps use a miniature Visual Context Message modal.
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
          <span className="inline-flex items-center gap-1">
            <CircleUser className="inline size-3.5 shrink-0 text-accent" aria-hidden />
            You
          </span>{" "}
          at the browser and mic —{" "}
          <span className="whitespace-nowrap text-foreground/90">Message</span> modal + clipboard are automatic
          assembly — then the agent runs the paste.
        </p>
      </div>

      {/* Mobile: vertical stack with image in agent block */}
      <div className="flex flex-col gap-4 p-4 md:hidden">
        {STEPS.map((step, i) => (
          <div key={step.id}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent/50 bg-accent/10 text-xs font-bold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <StepAffordance kind={step.kind} />
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
                    <div className="relative border-b border-border/60 bg-accent/10 px-3 py-2">
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-accent/35 bg-accent/15 text-accent">
                        <Bot className="size-3.5" aria-hidden />
                      </span>
                      <p className="pr-8 text-center text-[11px] font-bold uppercase tracking-wide text-accent">
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
                className="absolute z-[5] w-[min(42vw,220px)] max-w-[220px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                <div
                  className={cn(
                    "relative rounded-xl border bg-card/95 px-2 py-2 text-center shadow-md backdrop-blur-sm",
                    step.kind === "user" && "border-accent/35",
                    step.kind === "automatic" && "border-primary/30 ring-1 ring-border/60",
                  )}
                >
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted/80 text-[9px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <StepAffordance kind={step.kind} dense />
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
