# Species Tracking, Authorship & Showcase

**Source:** Session 2026-04-16c discussion (decisions gad-213, gad-215)

## Requirements

- Track how many times a species has been used across projects and generations
- Track original author and editing authors (authorship chain)
- Species and generations have associated media (screenshots, videos, demos)
- Species showcase: relevant projects/generations of note to demonstrate capability
- Generation completion produces "loot" — salvaged data, new skills, discovered requirements
- Bidirectional flow: promote generation discoveries to project requirements or species config

## Data model questions

- How to track usage without bloating the database (count + last-used vs full history?)
- Author chain: git blame on species.json? Explicit authors array? Both?
- Media association: convention-based (assets/media/) or explicit manifest?
- How does this work in local-first model vs hosted platform?

## Next step

Design the species.json schema extensions for tracking fields.
