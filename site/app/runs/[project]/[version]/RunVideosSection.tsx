import Link from "next/link";
import { Film } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import VideoEmbed from "@/components/video/VideoEmbed";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import type { CompositionEntry } from "@/remotion/registry";

export function RunVideosSection({ videos }: { videos: CompositionEntry[] }) {
  if (videos.length === 0) return null;
  return (
    <SiteSection cid="run-videos-section-site-section" tone="muted">
      <Identified as="RunVideos">
      <SiteSectionHeading
        icon={Film}
        kicker="Watch this dissection"
        title={videos.length === 1 ? "A 20-second walkthrough" : `${videos.length} walkthroughs`}
      />
      <Identified as="RunVideosProse">
        <SiteProse size="md" className="mt-3">
          Remotion React composition, rendered live in your browser. No MP4, no download, no external
          player. Reuses the same components as the rest of the site so the video stays accurate to the
          live data by construction. Press play, pause any time, scrub the timeline.
        </SiteProse>
      </Identified>
      <Identified as="RunVideosGrid" className="mt-10 grid gap-10 lg:grid-cols-1">
          {videos.map((c) => (
            <VideoEmbed key={c.slug} composition={c} />
          ))}
      </Identified>
      <Identified as="RunVideosCatalogLink" className="mt-10">
        <Link
          href="/videos"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
        >
          Browse all video dissections →
        </Link>
      </Identified>
      </Identified>
    </SiteSection>
  );
}
