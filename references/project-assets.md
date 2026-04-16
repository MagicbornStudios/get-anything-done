# Project Assets Convention (decision gad-210)

Every GAD project may have an `assets/` directory at its root for marketing,
media, and reusable content that persists across species and generations.

## Directory structure

```
<project-root>/
  assets/
    media/          # marketing images, screenshots, cover art
    audio/          # music, sound effects, voice
    video/          # trailers, walkthroughs, demos
    data/           # reusable structured data (JSON, YAML)
      salvaged/     # auto-extracted from generation runs
```

## Salvage pipeline

When a generation completes, `gad generation salvage` extracts valuable
data assets from the run output back to the species level:

  generation run/public/data/*.json  →  species/<name>/assets/data/salvaged/<version>/

The next generation can seed from salvaged data instead of regenerating.

## What gets salvaged

- JSON data files (game content, dialogue, entities, items, maps)
- Configuration that the agent authored (not framework config)
- Any file matching patterns in species.json `salvagePatterns` array

## What does NOT get salvaged

- Built artifacts (JS bundles, source maps)
- Framework files (.planning/ XML, AGENTS.md)
- Dependencies (node_modules, package-lock)
