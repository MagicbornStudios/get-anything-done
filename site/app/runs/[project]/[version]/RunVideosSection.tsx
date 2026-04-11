import Link from "next/link";
import { Film } from "lucide-react";
import VideoEmbed from "@/components/video/VideoEmbed";
import type { CompositionEntry } from "@/remotion/registry";

export function RunVideosSection({ videos }: { videos: CompositionEntry[] }) {
  if (videos.length === 0) return null;
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-2 flex items-center gap-2">
          <Film size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Watch this dissection</p>
        </div>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {videos.length === 1 ? "A 20-second walkthrough" : `${videos.length} walkthroughs`}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Remotion React composition, rendered live in your browser. No MP4, no download, no
          external player. Reuses the same components as the rest of the site so the video stays
          accurate to the live data by construction. Press play, pause any time, scrub the
          timeline.
        </p>
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
      </div>
    </section>
  );
}
