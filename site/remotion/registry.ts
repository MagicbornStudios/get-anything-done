/**
 * Composition registry for Remotion videos.
 *
 * Every composition is a React component rendered at 30fps for up to 900 frames
 * (30 seconds max — decision gad-57). All compositions are cinematic
 * passthroughs (linear timeline, no branching) with play/pause controls via
 * the @remotion/player wrapper.
 *
 * To add a composition:
 *   1. Create site/remotion/compositions/<name>.tsx exporting a React component
 *      that takes props as its inputProps (all props optional + defaulted).
 *   2. Add an entry to COMPOSITIONS below with slug, title, tags, author note.
 *   3. It shows up on /videos automatically. Embed inline via <VideoEmbed slug="..." />.
 */

import { V8DissectionComposition } from "./compositions/V8Dissection";

export interface CompositionEntry {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  relatedRun?: { project: string; version: string };
  status: "placeholder" | "draft" | "published";
}

export const COMPOSITIONS: CompositionEntry[] = [
  {
    slug: "v8-dissection",
    title: "Escape the Dungeon v8 — process metrics lied",
    description:
      "A 20-second walkthrough of how v8 scored composite 0.18 while the game itself was broken. Shows the weighted-sum math in motion and the tracing gap that made the score unexplainable after the fact.",
    tags: ["failure-case", "tracing-gap", "gad-29", "escape-the-dungeon"],
    durationInFrames: 600, // 20s @ 30fps
    fps: 30,
    width: 1280,
    height: 720,
    component: V8DissectionComposition,
    relatedRun: { project: "escape-the-dungeon", version: "v8" },
    status: "placeholder",
  },
];

export function getComposition(slug: string): CompositionEntry | undefined {
  return COMPOSITIONS.find((c) => c.slug === slug);
}

export function compositionsForRun(project: string, version: string): CompositionEntry[] {
  return COMPOSITIONS.filter(
    (c) => c.relatedRun?.project === project && c.relatedRun.version === version
  );
}
