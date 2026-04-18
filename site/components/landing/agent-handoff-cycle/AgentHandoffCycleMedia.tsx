import { Clipboard, Keyboard, Mic, MousePointer2 } from "lucide-react";
import { gsdUpstreamPlanningTalkWatchUrl } from "@/components/landing/gsd-upstream-media";

/**
 * Sidebar for the live VCS demo band.
 *
 * Shows a compact "what the panel looks like" control sheet plus a sample of
 * the clipboard payload the visitor will actually see, so the demo is legible
 * even before they toggle dev IDs. Upstream-context link is demoted to a
 * one-liner at the bottom.
 */
export function AgentHandoffCycleMedia() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-2xl border border-border/60 bg-card/40 shadow-inner shadow-black/10">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-accent/80" aria-hidden />
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Visual Context panel
            </p>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground/70">
            data-cid: agent-handoff-cycle-site-section
          </span>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <Keyboard size={14} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Toggle dev IDs</p>
              <p className="text-xs leading-snug text-muted-foreground">
                <kbd className="rounded border border-border/60 bg-background/70 px-1 py-0.5 font-mono text-[10px]">
                  Alt
                </kbd>
                <span className="mx-0.5 text-muted-foreground/70">+</span>
                <kbd className="rounded border border-border/60 bg-background/70 px-1 py-0.5 font-mono text-[10px]">
                  I
                </kbd>{" "}
                reveals the cid badge on every band.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <MousePointer2 size={14} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Hover + pick a verb</p>
              <p className="text-xs leading-snug text-muted-foreground">
                <code className="rounded bg-background/70 px-1 font-mono text-[10px]">Update</code>{" "}
                (narrate the change) or{" "}
                <code className="rounded bg-background/70 px-1 font-mono text-[10px]">Delete</code>{" "}
                (read-only brief).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <Mic size={14} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Narrate or type</p>
              <p className="text-xs leading-snug text-muted-foreground">
                Web Speech merges into the Update flow; typed notes append below the locked template.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <Clipboard size={14} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Stop → prompt on clipboard</p>
              <p className="text-xs leading-snug text-muted-foreground">
                Route, cid, source-file hints, and CRUD scaffolding all pre-filled.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 bg-background/50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80">
            Clipboard payload — example
          </p>
          <pre className="mt-1 overflow-hidden rounded-md border border-border/50 bg-background/70 px-3 py-2 font-mono text-[11px] leading-snug text-foreground/85">
{`Update target.
Route: http://localhost:3001/
Target: agent-handoff-cycle-site-section
Source hint: LandingAgentHandoffCycle (SiteSection)
Operation: UPDATE
Notes:
  <your narration>`}
          </pre>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Philosophy is upstream of{" "}
        <a
          href={gsdUpstreamPlanningTalkWatchUrl()}
          className="font-medium text-accent underline-offset-2 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get Shit Done — creator talk ↗
        </a>
      </p>
    </div>
  );
}
