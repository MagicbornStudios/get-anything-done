import mediaData from "@/data/media.json";

export const GSD_UPSTREAM = "https://github.com/gsd-build/get-shit-done";

const { id: YOUTUBE_ID, start_sec: YOUTUBE_START_SEC } = mediaData.videos.lineage_talk;

export function lineageEmbedSrc(): string {
  return `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?start=${YOUTUBE_START_SEC}`;
}

export function lineageWatchUrl(): string {
  return `https://www.youtube.com/watch?v=${YOUTUBE_ID}&t=${YOUTUBE_START_SEC}s`;
}
