import { CardHeader } from "@/components/ui/card";

export default function VideoEmbedChromeBar({
  slug,
  durationInFrames,
  fps,
}: {
  slug: string;
  durationInFrames: number;
  fps: number;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 bg-card/40 p-0 px-4 py-2.5 text-xs">
      <span className="font-mono uppercase tracking-wider text-muted-foreground">
        video · {slug}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {(durationInFrames / fps).toFixed(0)}s · {fps}fps
      </span>
    </CardHeader>
  );
}
