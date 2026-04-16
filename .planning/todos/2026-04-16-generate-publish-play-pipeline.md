# Todo: generate-publish-play-pipeline

**Captured:** 2026-04-16
**Area:** editor / site / infra
**Urgency:** blocking

## What

The editor-to-playable pipeline. Three concrete surfaces:

### 1. Generate button in editor
- Species deck card gets a "Generate" action button
- Clicks trigger `gad eval run <project> --species <name>` via command bridge
- Shows real-time progress (SSE stream from command bridge)
- On completion, auto-runs `gad eval preserve` to save the build
- Generation appears in bestiary with playable link

### 2. Publish action on generations
- Each generation in the bestiary/inspector gets a "Publish" toggle
- Published generations are served from `public/playable/<project>/<species>/<version>/`
- The publish action copies the preserved build to the public serve path
- Unpublish removes from public path but keeps the preserved source

### 3. Library / Arcade dashboard
- New route: `/library` or `/arcade` or `/play`
- Grid of published playable generations across all projects
- Each card: project name, species, version, thumbnail/gradient, "Play" button
- Play launches in full-viewport iframe (no editor chrome)
- Filter by project, domain (game/site/cli), species
- This is the "Steam client" for GAD generations

## Why

The editor is a dev tool. Users need to see the OUTPUT — play the games, use the apps. Without this pipeline, the editor is useful but the results are invisible. This is the difference between "I built something" and "I can use what I built."

## Context

- PreviewFrame exists with device toggle — foundation for play mode
- `gad eval run` and `gad eval preserve` exist as CLI commands
- Command bridge can execute gad commands from the browser
- Preserved builds already land at `public/playable/<project>/<species>/<version>/`
- The marketplace (`/project-market`) shows project cards but not individual playable generations

## Suggested next action

This should be the NEXT phase to implement — before visual rebrand wave 3. The pipeline makes the product usable. Visual polish can come after.
