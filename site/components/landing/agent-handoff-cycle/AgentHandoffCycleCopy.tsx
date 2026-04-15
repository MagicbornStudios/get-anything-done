import { Badge } from "@/components/ui/badge";
import { GSD_UPSTREAM } from "@/components/landing/gsd-upstream-media";
import { SiteProse, SiteSectionIntro } from "@/components/site";

export function AgentHandoffCycleCopy() {
  return (
    <div>
      <SiteSectionIntro
        kicker="Worked example"
        preset="hero-compact"
        titleClassName="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl"
        title="From this band to a terminal — and back."
        proseClassName="max-w-2xl"
      >
        The section above walks the visual-context system: dev IDs on, hover a{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-xs">SiteSection</code> band,
        open the panel, pick a verb (update or delete), narrate the change while Web Speech runs, then
        stop — the quick prompt lands on the clipboard with route,{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-xs">cid</code>, search hints,
        and CRUD scaffolding already filled. This band (
        <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-xs">
          agent-handoff-cycle-site-section
        </code>
        ) is the live target: the verbatim handoff that built it sits in the showcase block above.
      </SiteSectionIntro>
      <SiteProse size="md" className="mt-4 max-w-2xl">
        You paste that brief into{" "}
        <span className="font-medium text-foreground">Claude Code</span>, Cursor, Codex, or any agent
        that accepts text — the loop is the same because skills and workflows name real UI tokens,
        not screenshots alone. GAD itself stays downstream of{" "}
        <a
          href={GSD_UPSTREAM}
          className="text-accent underline-offset-4 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get Shit Done
        </a>
        : small loops and visible state, plus measurement so regressions surface in numbers instead of
        vibes — the linked talk is still the clearest articulation of why structure beats ad-hoc
        prompting.
      </SiteProse>
      <div className="mt-8 flex flex-wrap gap-3">
        <Badge variant="outline">Visual-context handoff</Badge>
        <Badge variant="outline">Agent-agnostic paste</Badge>
        <Badge variant="outline">GSD → measured GAD</Badge>
      </div>
    </div>
  );
}
