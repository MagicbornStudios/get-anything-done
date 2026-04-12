import Link from "next/link";
import { Film } from "lucide-react";
import VideoEmbed from "@/components/video/VideoEmbed";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import type { CompositionEntry } from "@/remotion/registry";

export function RunVideosSection({ videos }: { videos: CompositionEntry[] }) {
  if (videos.length === 0) return null;
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={Film}
        kicker="Watch this dissection"
        title={videos.length === 1 ? "A 20-second walkthrough" : `${videos.length} walkthroughs`}
      />
      <SiteProse size="md" className="mt-3">
        Remotion React composition, rendered live in your browser. No MP4, no download, no external
        player. Reuses the same components as the rest of the site so the video stays accurate to the
        live data by construction. Press play, pause any time, scrub the timeline.
      </SiteProse>
      <div className="mt-10 grid gap-10 lg:grid-cols-1">
          {videos.map((c) => (
            <VideoEmbed key={c.slug} composition={c} />
          ))}
        </div>
      <Link
        href="/videos"
        className="mt-10 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
      >
        Browse all video dissections →
      </Link>
    </SiteSection>
  );
}
