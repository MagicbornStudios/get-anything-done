"use client";

import type { CompositionEntry } from "@/remotion/registry";
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
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
        <VideoEmbedChromeBar
          slug={composition.slug}
          durationInFrames={composition.durationInFrames}
          fps={composition.fps}
        />
        <VideoEmbedRemotionPlayer composition={composition} autoPlay={autoPlay} loop={loop} />
      </div>
      <VideoEmbedMeta composition={composition} />
    </div>
  );
}
