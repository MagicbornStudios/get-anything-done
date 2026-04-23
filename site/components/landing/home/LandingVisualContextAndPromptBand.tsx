import { Identified } from "@portfolio/visual-context";
import { SiteSection, SiteProse } from "@/components/site";
import { LandingHandoffTemplatesShowcase } from "@/components/landing/home/LandingHandoffTemplatesShowcase";
import { LandingVisualContextPanelShowcase } from "@/components/landing/home/LandingVisualContextPanelShowcase";

/** Band pattern matches Playable / agent-handoff — section shell + band dev panel on `visual-context-site-section`. */
export function LandingVisualContextAndPromptBand() {
  return (
    <SiteSection id="visual-context" cid="visual-context-site-section" className="border-t border-border/60">
      <Identified as="LandingVisualContextShowcase">
        <Identified as="LandingVisualContextIntroKicker" className="block">
          <p className="section-kicker">Visual context system</p>
        </Identified>
        <Identified as="LandingVisualContextIntroTitle" className="block">
          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            From what you see <span className="gradient-text">to what you grep.</span>
          </h2>
        </Identified>
        <Identified as="LandingVisualContextIntroBody">
          <SiteProse size="lg" className="mt-5 max-w-3xl">
            <strong className="font-semibold text-foreground">Point at the UI, not a screenshot.</strong>{" "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              Alt
            </kbd>
            {" + "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              I
            </kbd>{" "}
            lights greppable landmarks on every band — hover for the Visual Context Panel: one handoff
            with route, tokens, and context already wired.{" "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              Alt
            </kbd>
            {" + "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              K
            </kbd>{" "}
            searches the repo by the same names; dictate into the prompt when you want speed over typing.
          </SiteProse>
        </Identified>

        <Identified as="LandingVisualContextPanelShowcase" className="mt-8">
          <LandingVisualContextPanelShowcase />
        </Identified>

        <Identified as="LandingPageGenerationPromptExample" className="mt-10">
          <p className="text-sm font-semibold text-foreground">Agent handoff templates (quick prompts)</p>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Same Update / Delete template strings as the Agent handoff modal, built for a live landmark on
            this route:{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">cid="agent-handoff-cycle-site-section"</code>{" "}
            (the band below). Read-only CodeMirror — open the real modal from any band panel to edit, dictate,
            and copy.
          </p>
          <div className="mt-4">
            <LandingHandoffTemplatesShowcase />
          </div>
        </Identified>
      </Identified>
    </SiteSection>
  );
}
