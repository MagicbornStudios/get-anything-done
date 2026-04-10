# GAD Explainer Video — Agent Instructions

## Your task

Build a 30-second Remotion video composition that explains the GAD framework to a first-time viewer. The video must hit 4 mandatory gate frames (see REQUIREMENTS.md).

## Stack

- **Runtime:** Remotion (@remotion/player for site embed, @remotion/cli for rendering)
- **Language:** TypeScript + React
- **Output:** A composition at `remotion/GadExplainer.tsx` registered in `remotion/Root.tsx`

## What you must produce

1. A Remotion composition component (`GadExplainer.tsx`) that renders all 4 gate frames with motion, typography, and visual energy
2. A Root.tsx composition registry that registers the composition at 30fps, 1920x1080, 900 frames (30 seconds)
3. The composition must render via `npx remotion render Root gad-explainer out.mp4`
4. The composition must play via `@remotion/player` (already installed)

## Quality bar

This is NOT a slideshow. It's a motion graphics piece. Use:
- Animated transitions between sections
- Spring/interpolation for text reveals
- Color-coded visual language (emerald = bare, sky = GAD, amber = emergent, rose = skeptic)
- The .planning/ folder structure cascading open as a visual metaphor

## Duration

**30 seconds maximum. Hard cap.** 4 sections × ~7 seconds each.

## After building

Run `npx remotion render Root gad-explainer out.mp4` to verify the render completes without errors. Commit the composition files.
