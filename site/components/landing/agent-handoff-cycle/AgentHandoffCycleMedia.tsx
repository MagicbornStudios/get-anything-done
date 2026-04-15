import { gsdUpstreamPlanningTalkWatchUrl } from "@/components/landing/gsd-upstream-media";

/** Terminal frame is embedded in the cycle diagram above; this column is upstream context only. */
export function AgentHandoffCycleMedia() {
  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card/30 p-6 text-center shadow-inner shadow-black/10">
      <p className="text-sm font-semibold text-foreground">Upstream context</p>
      <p className="mt-2 text-sm text-muted-foreground">
        The structured-planning argument behind small loops and visible state — same philosophy the
        visual-context handoff is built for, measured instead of left to vibes.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        <a
          href={gsdUpstreamPlanningTalkWatchUrl()}
          className="font-medium text-accent underline-offset-2 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          GSD upstream — creator talk (YouTube) ↗
        </a>
      </p>
    </div>
  );
}
