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
 *   3. It shows up on /videos automatically. Embed inline via <VideoEmbed composition={...} />.
 */

import { V8DissectionComposition } from "./compositions/V8Dissection";
import { VcsExplainerComposition } from "./compositions/VcsExplainer";
import { GadEvolutionExplainerComposition } from "./compositions/GadEvolutionExplainer";

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
    slug: "vcs-explainer",
    title: "Visual context system — anywhere",
    description:
      "A 30-second walkthrough of the Visual Context System pattern: source-searchable cid/as identifiers, the SiteSection + Identified landmark pair, and the four skills that install this pattern into any GUI project.",
    tags: ["skill", "gad-visual-context-system", "vcs", "explainer"],
    durationInFrames: 900, // 30s @ 30fps
    fps: 30,
    width: 1920,
    height: 1080,
    component: VcsExplainerComposition,
    status: "draft",
  },
  {
    slug: "gad-evolution-explainer",
    title: "Skills born from pressure — the GAD evolution loop",
    description:
      "30 seconds on why get-anything-done is evolutionary: the Pressure v3 formula (gad-222) that names skill candidates, the five-step detect → candidate → draft → install → shed loop, and the claim that every skill on this site was born this way.",
    tags: ["framework", "evolution", "pressure", "explainer", "gad-222"],
    durationInFrames: 900, // 30s @ 30fps
    fps: 30,
    width: 1920,
    height: 1080,
    component: GadEvolutionExplainerComposition,
    status: "draft",
  },
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
