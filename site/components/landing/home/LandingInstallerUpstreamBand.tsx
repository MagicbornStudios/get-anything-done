import Link from "next/link";
import { Download, ExternalLink, Film } from "lucide-react";
import { Identified } from "gad-visual-context";
import { SiteSection, SiteSectionIntro } from "@/components/site";
import { Button } from "@/components/ui/button";
import { GSD_UPSTREAM, handoffCycleWatchUrl } from "@/components/landing/gsd-upstream-media";

export function LandingInstallerUpstreamBand() {
  return (
    <SiteSection
      id="install"
      cid="install-site-section"
      tone="muted"
      className="border-t border-border/60 bg-card/15"
    >
      <Identified as="LandingInstallerUpstreamBand">
        <SiteSectionIntro
          kicker="Install + upstream context"
          preset="hero-compact"
          title={
            <>
              Ship the installer. <span className="gradient-text">Credit the lineage.</span>
            </>
          }
        >
          Windows builds publish on GitHub Releases — the installer is how teams pull templates,
          hooks, and CLI updates without cloning this monorepo. When you want the human story behind
          structured planning loops, watch the upstream session, then browse the original GSD
          repository for their cadence (we iterate our fork separately).
        </SiteSectionIntro>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <Button
            size="lg"
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
            asChild
          >
            <Link href="/downloads">
              <Download size={18} aria-hidden />
              Downloads &amp; templates
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold"
            asChild
          >
            <a href={handoffCycleWatchUrl()} rel="noopener noreferrer" target="_blank">
              <Film size={18} aria-hidden />
              Watch the GSD stream talk
              <ExternalLink className="size-4 opacity-70" aria-hidden />
            </a>
          </Button>
          <Button variant="ghost" size="lg" className="rounded-full px-6 text-sm" asChild>
            <a href={GSD_UPSTREAM} rel="noopener noreferrer" target="_blank">
              GSD upstream repository
              <ExternalLink className="size-4 opacity-70" aria-hidden />
            </a>
          </Button>
        </div>

        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
          We do not ask operators to track our private iteration velocity — consume releases, read
          decisions in{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-xs">DECISIONS.xml</code>, and only open
          our GitHub when you intend to fork or patch the framework itself.
        </p>
      </Identified>
    </SiteSection>
  );
}