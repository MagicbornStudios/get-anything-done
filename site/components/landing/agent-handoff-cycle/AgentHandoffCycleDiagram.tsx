import { RotateCcw } from "lucide-react";

const STEPS: { title: string; detail: string }[] = [
  { title: "Browse the site", detail: "Dev IDs on — you see real section and component tokens." },
  { title: "Grab context fast", detail: "Hover the band → Visual Context Panel → quick prompt scaffold." },
  { title: "Capture detail", detail: "Dictate with Web Speech; CRUD verbs fold into the template." },
  { title: "Clipboard", detail: "One copy — route, search hints, skill refs, workflow XML." },
  { title: "Coding agent", detail: "Paste into Claude Code, Cursor, Codex, or any agent session." },
  { title: "Ship & return", detail: "Agent edits the repo; you reload the site and run the loop again." },
];

/**
 * Read-only cycle diagram — handoff loop from marketing site to terminal and back.
 */
export function AgentHandoffCycleDiagram() {
  return (
    <div
      className="mb-12 rounded-2xl border border-border/60 bg-gradient-to-b from-card/40 to-card/10 p-6 md:p-8"
      role="region"
      aria-label="Site to coding agent handoff cycle"
    >
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handoff cycle</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Rinse · repeat — same greppable landmarks every lap (
          <code className="rounded bg-muted/50 px-1 font-mono text-[10px]">cid</code> /{" "}
          <code className="rounded bg-muted/50 px-1 font-mono text-[10px]">data-cid</code>).
        </p>
      </div>

      <ol className="mx-auto max-w-2xl space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-xs font-bold text-accent"
              aria-hidden
            >
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-foreground">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <RotateCcw className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <span>Loop closes when you ship, refresh, and point the panel at the next band.</span>
      </div>
    </div>
  );
}
