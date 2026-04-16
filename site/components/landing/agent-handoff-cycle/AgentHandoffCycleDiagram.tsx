"use client";

import { useCallback, useEffect, useId, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Bot, CircleUser, Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

const STEP_DETAILS: Record<
  string,
  { title: string; body: string; jumpHref?: string; jumpLabel?: string }
> = {
  browse: {
    title: "Browse the site",
    body: "Toggle dev IDs (Alt+I). Every SiteSection band exposes a stable cid and data-cid so you and agents grep the same token. Hover the band you want to change — that is the anchor for the handoff.",
    jumpHref: "#visual-context",
    jumpLabel: "Visual context band on this page",
  },
  panel: {
    title: "Visual Context → Message",
    body: "With dev IDs on, hover a section band to open the compact panel, then Message. The real DevIdAgentPromptDialog offers Update and Delete tabs: locked template plus editable notes (Update) or read-only delete brief (Delete). Web Speech merges into the Update flow when the mic is on.",
    jumpHref: "#visual-context",
    jumpLabel: "Scroll to Visual context section",
  },
  speech: {
    title: "You capture intent",
    body: "Dictate while the mic listens; CRUD verbs and route or component tokens stay in the scaffold so you are not retyping structure by hand.",
    jumpHref: "#visual-context",
    jumpLabel: "How speech fits the prompt",
  },
  clipboard: {
    title: "Clipboard assembly",
    body: "When you copy from the dialog, the framework joins the locked prefix, your notes, and search hints into one payload — ready to paste into any coding agent session.",
  },
  agent: {
    title: "Coding agent",
    body: "Paste into Claude Code, Cursor, Codex, or any tool that accepts text. The same cid tokens still resolve in the repo after the agent edits and you refresh.",
  },
  ship: {
    title: "Ship and return",
    body: "Land the change in git, refresh the page, and point the panel at the next band. The loop is the same every lap.",
    jumpHref: "#visual-context",
    jumpLabel: "Back to Visual context",
  },
};

const N = STEPS.length;

/** Decorative — mirrors DevIdAgentPromptDialog Message strip (Update / Delete + mic). */
function VisualContextModalMicro({
  className,
  interactive,
  onPickVerb,
}: {
  className?: string;
  interactive?: boolean;
  onPickVerb?: (verb: "update" | "delete") => void;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[9.75rem] overflow-hidden rounded-lg border border-border/80 bg-popover text-left shadow-md",
        className,
      )}
      aria-hidden={!interactive}
    >
      <div className="flex items-center justify-between gap-1 border-b border-border/60 bg-muted/50 px-1.5 py-1">
        <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
          Message
        </span>
        <div className="flex gap-0.5">
          {interactive ? (
            <>
              <button
                type="button"
                className="rounded-sm bg-accent/25 px-1 py-0.5 text-[7px] font-semibold text-accent hover:bg-accent/35"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickVerb?.("update");
                }}
              >
                Update
              </button>
              <button
                type="button"
                className="rounded-sm bg-muted px-1 py-0.5 text-[7px] font-medium text-muted-foreground hover:bg-muted/80"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickVerb?.("delete");
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <span className="rounded-sm bg-accent/25 px-1 py-0.5 text-[7px] font-semibold text-accent">
                Update
              </span>
              <span className="rounded-sm bg-muted px-1 py-0.5 text-[7px] font-medium text-muted-foreground">
                Delete
              </span>
            </>
          )}
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

function StepAffordance({
  kind,
  dense,
  interactiveModal,
  onPickVerb,
}: {
  kind: StepKind;
  dense?: boolean;
  interactiveModal?: boolean;
  onPickVerb?: (verb: "update" | "delete") => void;
}) {
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
      <div
        className={cn("flex justify-center", dense ? "mb-0.5" : "mb-1.5")}
        title="Visual Context handoff"
      >
        <VisualContextModalMicro
          className={dense ? "max-w-[8.5rem]" : undefined}
          interactive={interactiveModal}
          onPickVerb={onPickVerb}
        />
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

function nodeCenter(i: number): { x: number; y: number } {
  const cx = 500;
  const cy = 340;
  const rx = 400;
  const ry = 248;
  const ang = (-Math.PI / 2 + (i / N) * 2 * Math.PI) as number;
  return { x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) };
}

function arcSegment(i: number): string {
  const a = nodeCenter(i);
  const b = nodeCenter((i + 1) % N);
  const large = 0;
  const sweep = 1;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A 400 248 0 ${large} ${sweep} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function selectableKeyHandler(onSelect: () => void) {
  return (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };
}

function HandoffStepDetail({
  stepId,
  panelVerb,
  detailId,
  onClose,
}: {
  stepId: string;
  panelVerb: "update" | "delete" | null;
  detailId: string;
  onClose: () => void;
}) {
  const base = STEP_DETAILS[stepId];
  if (!base) return null;
  const title =
    stepId === "panel" && panelVerb
      ? `${base.title} — ${panelVerb === "update" ? "Update" : "Delete"}`
      : base.title;
  const body =
    stepId === "panel" && panelVerb === "delete"
      ? `${base.body} Delete ships a read-only template: you confirm scope before copy.`
      : stepId === "panel" && panelVerb === "update"
        ? `${base.body} Update keeps the locked route/target prefix fixed while you edit the freeform instruction below it.`
        : base.body;

  return (
    <div
      id={detailId}
      role="region"
      aria-live="polite"
      className="border-t border-border/50 bg-muted/25 px-4 py-5 md:px-8"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{body}</p>
          {base.jumpHref ? (
            <a
              href={base.jumpHref}
              className="mt-3 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {base.jumpLabel ?? "Related section"}
            </a>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={onClose}
          aria-label="Close step detail"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Cyclical handoff diagram — steps are clickable; detail panel + optional Message verb chips.
 */
export function AgentHandoffCycleDiagram() {
  const detailRegionId = useId();
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [panelVerb, setPanelVerb] = useState<"update" | "delete" | null>(null);

  const clear = useCallback(() => {
    setActiveStepId(null);
    setPanelVerb(null);
  }, []);

  const selectStep = useCallback((id: string) => {
    setPanelVerb(null);
    setActiveStepId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clear]);

  const onPanelVerb = useCallback((verb: "update" | "delete") => {
    setActiveStepId("panel");
    setPanelVerb(verb);
  }, []);

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
          assembly — then the agent runs the paste.{" "}
          <span className="text-foreground/80">Click a step for detail.</span>
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4 md:hidden">
        {STEPS.map((step, i) => (
          <div key={step.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => selectStep(step.id)}
              onKeyDown={selectableKeyHandler(() => selectStep(step.id))}
              aria-label={`${step.title}, step ${i + 1} of ${N}. Select for detail.`}
              aria-expanded={activeStepId === step.id}
              aria-controls={activeStepId === step.id ? detailRegionId : undefined}
              className={cn(
                "w-full cursor-pointer rounded-2xl border text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                activeStepId === step.id
                  ? "border-accent/60 bg-accent/5 shadow-md ring-1 ring-accent/30"
                  : "border-border/50 bg-card/30 hover:border-accent/35 hover:bg-card/50",
              )}
            >
              <div className="flex items-start gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent/50 bg-accent/10 text-xs font-bold text-accent">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <StepAffordance
                    kind={step.kind}
                    interactiveModal={step.id === "panel"}
                    onPickVerb={step.id === "panel" ? onPanelVerb : undefined}
                  />
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.short}</p>
                  {step.isAgent ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={CLAUDE_CODE_HANDOFF_IMG}
                        alt="Claude Code session after pasting the site handoff."
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

      <div className="relative hidden min-h-[min(92vw,720px)] md:block md:min-h-[680px]">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-accent"
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
            Rinse · repeat — click any step for detail
          </text>
        </svg>

        <div className="absolute inset-0">
          {STEPS.map((step, i) => {
            const { x, y } = nodeCenter(i);
            const leftPct = (x / 1000) * 100;
            const topPct = (y / 720) * 100;
            const selected = activeStepId === step.id;
            if (step.isAgent) {
              return (
                <div
                  key={step.id}
                  className="absolute z-10 w-[min(92vw,420px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                >
                  <button
                    type="button"
                    onClick={() => selectStep(step.id)}
                    aria-label={`${step.title}, step ${i + 1} of ${N}. Select for detail.`}
                    aria-expanded={selected}
                    aria-controls={selected ? detailRegionId : undefined}
                    className={cn(
                      "block w-full cursor-pointer overflow-hidden rounded-2xl border-2 bg-card text-left shadow-2xl shadow-black/50 transition-[box-shadow,ring] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selected
                        ? "border-accent ring-2 ring-accent/40 ring-offset-2 ring-offset-background"
                        : "border-accent/50 ring-1 ring-accent/20 hover:ring-accent/35",
                    )}
                  >
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
                  </button>
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
                  role="button"
                  tabIndex={0}
                  onClick={() => selectStep(step.id)}
                  onKeyDown={selectableKeyHandler(() => selectStep(step.id))}
                  aria-label={`${step.title}, step ${i + 1} of ${N}. Select for detail.`}
                  aria-expanded={selected}
                  aria-controls={selected ? detailRegionId : undefined}
                  className={cn(
                    "relative w-full cursor-pointer rounded-xl border bg-card/95 px-2 py-2 text-center shadow-md backdrop-blur-sm transition-[box-shadow,ring] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    step.kind === "user" && "border-accent/35",
                    step.kind === "automatic" && "border-primary/30 ring-1 ring-border/60",
                    selected && "ring-2 ring-accent/50 ring-offset-2 ring-offset-background",
                  )}
                >
                  <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted/80 text-[9px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <StepAffordance
                    kind={step.kind}
                    dense
                    interactiveModal={step.id === "panel"}
                    onPickVerb={step.id === "panel" ? onPanelVerb : undefined}
                  />
                  <p className="text-[11px] font-semibold leading-tight text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{step.short}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeStepId ? (
        <HandoffStepDetail
          stepId={activeStepId}
          panelVerb={activeStepId === "panel" ? panelVerb : null}
          detailId={detailRegionId}
          onClose={clear}
        />
      ) : null}
    </div>
  );
}
