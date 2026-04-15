import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteProse } from "@/components/site";
import { LANDING_PAGE_GENERATION_PROMPT } from "@/components/landing/examples/landing-page-generation-prompt.example";
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
          <SiteProse size="lg" className="mt-5">
            Press{" "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              Alt
            </kbd>
            {" + "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              I
            </kbd>{" "}
            to toggle dev IDs, then hover any section band to open the live Visual Context Panel on the
            page. With dev IDs on, press{" "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              Alt
            </kbd>
            {" + "}
            <kbd className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
              K
            </kbd>{" "}
            to open the real component ID search (repo-backed). Landmarks use literal, source-searchable
            tokens:{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">SiteSection cid="…"</code> for
            outer bands,{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">Identified as="…"</code> for
            inner targets, mirrored into{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">data-cid</code> for the dev
            panel. The panel can merge Web Speech transcripts into the quick prompt so you dictate
            CRUD verbs (create / read / update / delete) against the highlighted node without retyping
            route + component data by hand.
          </SiteProse>
        </Identified>

        <Identified as="LandingVisualContextPanelShowcase" className="mt-8">
          <LandingVisualContextPanelShowcase />
        </Identified>

        <Identified as="LandingVisualContextPatternList" className="mt-8">
            <ul className="grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
              <li className="rounded-xl border border-border/60 bg-card/20 p-4">
                <span className="font-semibold text-foreground">UI + UX patterns</span>
                <p className="mt-2">
                  Section shells, editorial vs utility copy, motion discipline, and accessible
                  controls stay in the design system — product rules live beside the components they
                  reference.
                </p>
              </li>
              <li className="rounded-xl border border-border/60 bg-card/20 p-4">
                <span className="font-semibold text-foreground">Software design tokens</span>
                <p className="mt-2">
                  Search hints like <code className="text-xs">cid="play-site-section"</code> travel
                  with the band so agents can open the exact file span the human pointed at.
                </p>
              </li>
              <li className="rounded-xl border border-border/60 bg-card/20 p-4">
                <span className="font-semibold text-foreground">Workflow</span>
                <p className="mt-2">
                  Hover a band, copy the handoff payload, optionally dictate edits — the prompt
                  builder folds speech into the structured update template before anything ships.
                </p>
              </li>
            </ul>
        </Identified>

        <Identified as="LandingPageGenerationPromptExample" className="mt-10">
          <p className="text-sm font-semibold text-foreground">Showcase prompt (verbatim)</p>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Live target on this page:{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">cid="agent-handoff-cycle-site-section"</code>{" "}
            — the band below is what shipped when this block was last run through the panel; copy it
            without opening a modal if you want the same payload shape.
          </p>
          <pre className="mt-4 max-h-[min(28rem,55vh)] overflow-auto rounded-2xl border border-border/70 bg-muted/25 p-4 text-left text-xs leading-relaxed text-foreground/90 shadow-inner shadow-black/20">
            {LANDING_PAGE_GENERATION_PROMPT}
          </pre>
        </Identified>
      </Identified>
    </SiteSection>
  );
}
