import mediaData from "@/data/media.json";

/** GSD upstream Git repository (fork prior art). */
export const GSD_UPSTREAM = "https://github.com/gsd-build/get-shit-done";

const { id: YOUTUBE_ID, start_sec: YOUTUBE_START_SEC } = mediaData.videos.gsd_upstream_planning_talk;

/** Deep link to the structured-planning segment of the upstream talk. */
export function gsdUpstreamPlanningTalkWatchUrl(): string {
  return `https://www.youtube.com/watch?v=${YOUTUBE_ID}&t=${YOUTUBE_START_SEC}s`;
}

/** Alias — same URL; use when call sites still reference the handoff-cycle rename. */
export const handoffCycleWatchUrl = gsdUpstreamPlanningTalkWatchUrl;
