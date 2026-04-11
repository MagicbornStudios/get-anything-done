import { Player } from "@remotion/player";
import type { CompositionEntry } from "@/remotion/registry";

export default function VideoEmbedRemotionPlayer({
  composition,
  autoPlay,
  loop,
}: {
  composition: CompositionEntry;
  autoPlay: boolean;
  loop: boolean;
}) {
  const Component = composition.component;
  return (
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
  );
}
