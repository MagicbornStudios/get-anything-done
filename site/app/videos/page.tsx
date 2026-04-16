export const dynamic = "force-dynamic";
import Link from "next/link";
import { Play } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingShell, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import VideoEmbed from "@/components/video/VideoEmbed";
import { COMPOSITIONS } from "@/remotion/registry";

export const metadata = {
  title: "Videos — GAD",
  description:
    "Remotion compositions from the site registry — embeddable explainers up to 30s, built as TypeScript + React.",
};

export default function VideosPage() {
  return (
    <MarketingShell>
      <SiteSection cid="videos-page-intro-site-section">
        <Identified as="VideosPageIntro">
          <SiteSectionHeading
            kicker="Videos"
            as="h1"
            preset="hero"
            title={
              <>
                30-second explainers.{" "}
                <span className="gradient-text">Built by agents, rendered by Remotion.</span>
              </>
            }
          />
          <SiteProse className="mt-6">
            Each embed below is a row in{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-sm">remotion/registry.ts</code> — same
            metadata the per-run pages use when a composition is tied to a preserved eval. Add a
            composition there and it appears here automatically.
          </SiteProse>
        </Identified>
      </SiteSection>

      {COMPOSITIONS.length === 0 ? (
        <SiteSection cid="videos-page-categories-site-section" tone="muted">
          <Identified as="VideosEmptyState">
            <SiteProse size="sm">
              No compositions in the registry yet. Follow the checklist in{" "}
              <code className="rounded bg-card/60 px-1 py-0.5 text-xs">registry.ts</code> to add one.
            </SiteProse>
          </Identified>
        </SiteSection>
      ) : (
        COMPOSITIONS.map((c, i) => (
          <SiteSection
            key={c.slug}
            id={c.slug}
            cid={`${c.slug}-site-section`}
            tone={i % 2 === 0 ? "muted" : "default"}
          >
            <Identified as={`VideosComposition-${c.slug}`} className="contents">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Badge variant="default" className="inline-flex items-center gap-1.5">
                  <Play size={11} aria-hidden />
                  {c.slug}
                </Badge>
                <Badge variant="outline">
                  {Math.round(c.durationInFrames / c.fps)}s · {c.width}×{c.height} · {c.fps}fps
                </Badge>
                <Badge variant="outline">{c.status}</Badge>
              </div>
              <VideoEmbed composition={c} />
            </Identified>
          </SiteSection>
        ))
      )}
    </MarketingShell>
  );
}



