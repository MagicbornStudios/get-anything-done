"use client";

import { Player } from "@remotion/player";
import type { CompositionEntry } from "@/remotion/registry";

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
  const Component = composition.component;
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-2.5 text-xs">
          <span className="font-mono uppercase tracking-wider text-muted-foreground">
            video · {composition.slug}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {(composition.durationInFrames / composition.fps).toFixed(0)}s · {composition.fps}fps
          </span>
        </div>
        <Player
          component={Component}
          durationInFrames={composition.durationInFrames}
          compositionWidth={composition.width}
          compositionHeight={composition.height}
          fps={composition.fps}
          controls
          clickToPlay
          autoPlay={autoPlay}
          loop={loop}
          style={{ width: "100%", height: "auto", aspectRatio: `${composition.width}/${composition.height}` }}
        />
      </div>
      <div className="mt-3">
        <h3 className="text-base font-semibold text-foreground">{composition.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{composition.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          {composition.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border/70 bg-card/40 px-2 py-0.5 font-mono text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
