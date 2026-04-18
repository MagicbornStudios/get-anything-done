import { Badge } from "@/components/ui/badge";
import { GSD_UPSTREAM } from "@/components/landing/gsd-upstream-media";
import { SiteProse, SiteSectionIntro } from "@/components/site";

/**
 * Copy column of the handoff-cycle band.
 *
 * This *is* the live VCS demo on the landing page. Framing has to make that
 * explicit — the ring above is not a cartoon, it is the exact loop the visitor
 * can run against this very band, right now, without installing anything.
 */
export function AgentHandoffCycleCopy() {
  return (
    <div>
      <SiteSectionIntro
        kicker="Live VCS demo · try it on this band"
        preset="hero-compact"
        titleClassName="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl"
        title={
          <>
            The ring above is <span className="gradient-text">runnable</span> —
            on the very section you&apos;re reading.
          </>
        }
        proseClassName="max-w-2xl"
      >
        Every step in the diagram is a real control you can fire against the
        band named{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-xs">
          agent-handoff-cycle-site-section
        </code>
        . Toggle dev IDs, pick a verb, narrate the change, stop — and the quick
        prompt lands on your clipboard with route, <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-xs">cid</code>, source
        hints, and CRUD scaffolding already filled. Paste it into Claude Code,
        Cursor, Codex, or any agent that accepts text.
      </SiteSectionIntro>

      <ol className="mt-6 grid max-w-2xl gap-2.5 text-sm md:text-base">
        {[
          {
            n: "1",
            cmd: "Alt + I",
            body: "Toggle dev IDs. Every SiteSection band on the page now shows its cid label.",
          },
          {
            n: "2",
            cmd: "Hover this band",
            body: "The Visual Context panel opens with the cid, route, and source-hint pre-filled.",
          },
          {
            n: "3",
            cmd: "Pick a verb",
            body: "Update (narrate the change with Web Speech) or Delete (read-only brief).",
          },
          {
            n: "4",
            cmd: "Stop → paste",
            body: "The prompt is copied to the clipboard. Paste into any coding agent; come back and reload.",
          },
        ].map((step) => (
          <li
            key={step.n}
            className="flex min-w-0 items-start gap-3 rounded-lg border border-border/50 bg-card/30 px-3 py-2"
          >
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-xs text-accent">
              {step.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-foreground">{step.cmd}</p>
              <p className="text-xs leading-snug text-muted-foreground md:text-sm">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <SiteProse size="md" className="mt-6 max-w-2xl">
        The loop is agent-agnostic because the handoff names real UI tokens, not
        screenshots. GAD sits downstream of{" "}
        <a
          href={GSD_UPSTREAM}
          className="text-accent underline-offset-4 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get Shit Done
        </a>
        : small loops, visible state, measurement — so regressions surface in
        numbers instead of vibes.
      </SiteProse>

      <div className="mt-8 flex flex-wrap gap-3">
        <Badge variant="outline">Live demo</Badge>
        <Badge variant="outline">Agent-agnostic paste</Badge>
        <Badge variant="outline">CRUD verbs on every band</Badge>
      </div>
    </div>
  );
}
