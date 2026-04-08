"use client";

import { useEffect, useRef } from "react";
import { MessageCircle, Terminal, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

declare global {
  interface Window {
    mermaid?: {
      initialize: (cfg: Record<string, unknown>) => void;
      run: (cfg?: { nodes?: Element[] }) => Promise<void>;
    };
  }
}

const DIAGRAM = `flowchart TD
    classDef user fill:#7c5f3b,stroke:#c88d4c,color:#fff,stroke-width:2px
    classDef cmd fill:#1e3a5f,stroke:#6f88a3,color:#e0b378,stroke-width:2px
    classDef sub fill:#0f2e1a,stroke:#00c16a,color:#d9fbe8,stroke-width:2px
    classDef state fill:#3a1e2d,stroke:#c88d4c,color:#ffe4b5,stroke-width:2px

    U[User prompt] --> S["gad snapshot<br/>(context hydrate)"]
    S --> CMD{slash command?}
    CMD -->|/gad:plan-phase| PP[plan-phase skill]
    CMD -->|/gad:execute-phase| EX[execute-phase skill]
    CMD -->|/gad:verify-work| VR[verify-phase skill]
    CMD -->|no| LOOP[pick one task]

    PP --> PLAN[gad-planner<br/>subagent]
    PP --> RES[gad-phase-researcher<br/>subagent]
    PLAN --> PLANMD[(PLAN.md)]

    LOOP --> IMPL[implement task]
    EX --> IMPL
    IMPL --> REG[(TASK-REGISTRY.xml)]
    IMPL --> ST[(STATE.xml)]
    IMPL --> DEC[(DECISIONS.xml)]

    REG --> V{verify}
    ST --> V
    V --> VRR[gad-verifier<br/>subagent]
    VR --> VRR
    VRR --> REPORT[(VERIFICATION.md)]

    REPORT --> COMMIT[git commit]
    COMMIT --> S

    class U user
    class S,CMD,LOOP,IMPL,COMMIT cmd
    class PP,EX,VR,PLAN,RES,VRR sub
    class PLANMD,REG,ST,DEC,REPORT state`;

const CONVERSATION: Array<{ speaker: "user" | "agent" | "tool"; text: string }> = [
  {
    speaker: "user",
    text: "let's plan the next phase — we need to ship the eval preservation contract",
  },
  {
    speaker: "agent",
    text:
      "Running `gad snapshot --projectid get-anything-done` to hydrate context before planning.",
  },
  {
    speaker: "tool",
    text:
      "Snapshot (sprint 4): phases 18→22 · current: 18 · next-action: plan phase 19 preservation contract · 38 decisions loaded",
  },
  {
    speaker: "agent",
    text:
      "I'll use the `/gad:plan-phase 19` skill. Spawning gad-phase-researcher first to survey prior eval runs that lost their artifacts.",
  },
  {
    speaker: "tool",
    text:
      "gad-phase-researcher → 3 runs lost artifacts in worktree cleanup · root cause: no preserve step · proposed contract in RESEARCH.md",
  },
  {
    speaker: "agent",
    text:
      "Good. Spawning gad-planner with the research attached. Goal-backward verification on: evals preserved at canonical paths, tests enforce, verify command audits.",
  },
  {
    speaker: "tool",
    text:
      "gad-planner → PLAN.md written · 6 tasks · goal-backward verification passes · committed as 19-01 through 19-06",
  },
  {
    speaker: "user",
    text: "yes go",
  },
  {
    speaker: "agent",
    text:
      "Switching to `/gad:execute-phase 19`. Task 19-01: implement `gad eval preserve` command. Wave 1.",
  },
  {
    speaker: "tool",
    text:
      "git commit 19-01: feat(eval): add preserve command · TASK-REGISTRY.xml updated · STATE.xml next-action → 19-02",
  },
];

export default function Workflow() {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!mermaidRef.current) return;
      if (!window.mermaid) {
        const mod = await import("mermaid");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.mermaid = mod.default as unknown as any;
        window.mermaid!.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            background: "transparent",
            primaryColor: "#1e3a5f",
            primaryBorderColor: "#6f88a3",
            primaryTextColor: "#e0b378",
            lineColor: "#6f88a3",
            fontFamily: "inherit",
          },
          securityLevel: "loose",
        });
      }
      if (cancelled) return;
      const node = mermaidRef.current;
      if (!node) return;
      node.removeAttribute("data-processed");
      node.innerHTML = DIAGRAM;
      try {
        await window.mermaid!.run({ nodes: [node] });
      } catch (err) {
        console.error("mermaid render failed", err);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="workflow" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">The loop</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Five steps. <span className="gradient-text">Every session.</span> No variation.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          snapshot → pick one task → implement → update planning docs → commit. The CLI gives the
          agent a single command to re-hydrate context; skills tell the agent what methodology
          to apply; subagents do the expensive work off the main thread. That&apos;s the whole
          framework.
        </p>

        <div className="mt-12 rounded-2xl border border-border/70 bg-background/40 p-4 md:p-8">
          <div
            ref={mermaidRef}
            className="mermaid flex w-full items-center justify-center overflow-x-auto [&_svg]:max-w-full"
          >
            {DIAGRAM}
          </div>
        </div>

        <h3 className="mt-16 text-2xl font-semibold tracking-tight">What it looks like in the terminal</h3>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Abbreviated example of a real session — planning phase 19 with the CLI and subagents
          driving the work, the user stays out of the micromanagement.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-background/60">
          <div className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-5 py-3">
            <Terminal size={14} className="text-accent" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              example session
            </span>
          </div>
          <ul className="divide-y divide-border/40">
            {CONVERSATION.map((turn, i) => (
              <li key={i} className="flex items-start gap-4 px-5 py-4">
                <div
                  className={[
                    "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
                    turn.speaker === "user"
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : turn.speaker === "agent"
                        ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                  ].join(" ")}
                >
                  {turn.speaker === "user" ? (
                    <User size={13} aria-hidden />
                  ) : turn.speaker === "agent" ? (
                    <MessageCircle size={13} aria-hidden />
                  ) : (
                    <Terminal size={13} aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Badge
                      variant="outline"
                      className={
                        turn.speaker === "user"
                          ? "border-accent/40 text-accent"
                          : turn.speaker === "agent"
                            ? "border-sky-500/40 text-sky-300"
                            : "border-emerald-500/40 text-emerald-300"
                      }
                    >
                      {turn.speaker}
                    </Badge>
                  </div>
                  <p
                    className={[
                      "text-sm leading-6",
                      turn.speaker === "tool" ? "font-mono text-muted-foreground" : "text-foreground",
                    ].join(" ")}
                  >
                    {turn.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
