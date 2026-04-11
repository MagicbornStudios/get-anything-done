import { lineageEmbedSrc, lineageWatchUrl } from "@/components/landing/lineage/lineage-shared";

export function LineageMedia() {
  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
        <div className="aspect-video w-full">
          <iframe
            title="Get Shit Done — creator perspective on structured planning"
            className="h-full w-full"
            src={lineageEmbedSrc()}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        <a
          href={lineageWatchUrl()}
          className="underline-offset-2 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Open on YouTube ↗
        </a>
      </p>
    </div>
  );
}
