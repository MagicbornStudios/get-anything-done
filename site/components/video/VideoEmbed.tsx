"use client";

import type { CompositionEntry } from "@/remotion/registry";
import { Card, CardContent } from "@/components/ui/card";
import VideoEmbedChromeBar from "./VideoEmbedChromeBar";
import VideoEmbedRemotionPlayer from "./VideoEmbedRemotionPlayer";
import VideoEmbedMeta from "./VideoEmbedMeta";

export interface VideoEmbedProps {
  composition: CompositionEntry;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
}

/**
 * Inline Remotion player wrapper. Used on per-run pages and /videos to embed
 * any composition from the registry with standard controls. Capped at 30s via
 * the composition's durationInFrames — the registry enforces that.
 */
export default function VideoEmbed({
  composition,
  autoPlay = false,
  loop = false,
  className,
}: VideoEmbedProps) {
  return (
    <div className={className}>
      <Card className="overflow-hidden rounded-2xl border-border/70 bg-background shadow-2xl shadow-black/40">
        <VideoEmbedChromeBar
          slug={composition.slug}
          durationInFrames={composition.durationInFrames}
          fps={composition.fps}
        />
        <CardContent className="p-0">
          <VideoEmbedRemotionPlayer composition={composition} autoPlay={autoPlay} loop={loop} />
        </CardContent>
      </Card>
      <VideoEmbedMeta composition={composition} />
    </div>
  );
}
