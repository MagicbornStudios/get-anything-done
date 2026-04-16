# VCS Showcase Video + Primitives Research

**Source:** Session 2026-04-16c (decision gad-216)

## Video outline

Showcase video of me demonstrating:
1. VCS components in the live site — Identified, panels, sections, context capture
2. The GAD loop — snapshot → task → implement → commit
3. Skills that implement VCS — how an agent reads the skill and instruments a UI
4. Voice-first workflow — speaking to landmarks, quick prompts
5. Minimal surface demo — what's the least UI needed for an agent to understand what you see?

## Primitives research

Core question: what is the MINIMAL set of components/patterns any project needs?

Current hypothesis (from site experience):
- `Identified` wrapper — gives any element a `data-cid`
- Panel/footer — attaches to a section, shows local landmark data
- Context capture — collect all visible IDs into a prompt
- Self-referential iteration — panel has its own IDs, can iterate on itself

NOT required (possibly):
- SiteSection — structural convenience, identifiers work without it
- Full DevPanel — may be overkill for non-web projects

## Test plan

1. Extract VCS skill files into standalone set
2. Run escape-the-dungeon generation with VCS skills installed
3. Check: did the agent build identifiers + panel? Can we talk about elements?
4. Iterate on skills based on what the agent got wrong

## Cross-renderer question

How does this work in:
- React DOM (proven — our site)
- Kaplay/canvas (unproven — escape-the-dungeon)
- Phaser (unproven)
- Terminal/CLI (unproven)

## Next step

Find escape-the-dungeon v1/v2 requirements. Create a VCS test species.
