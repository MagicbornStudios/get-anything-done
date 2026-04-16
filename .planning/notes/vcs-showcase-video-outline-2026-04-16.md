# VCS Showcase Video Outline

**Target:** 5-10 minute walkthrough demonstrating the Visual Context System,
the GAD loop, and how skills make any project agent-addressable.

## Act 1: The Problem (1-2 min)

- Screen: open a complex UI in a browser
- "I see a button I want to change. How do I tell the AI where it is?"
- Show the pain: describing UI elements in chat is ambiguous, error-prone
- "What if every element had a stable name I could just copy?"

## Act 2: The VCS in Action (2-3 min)

- Screen: GAD landing site with dev panel visible
- Toggle dev panel with keyboard shortcut
- Hover over sections — show CID highlights
- Click a CID — it copies to clipboard with context
- Paste into agent prompt: "Change the heading in `how-it-works-hero`"
- Show: `grep -rn "how-it-works-hero" site/app/` → exact file, exact line
- Voice demo: speak the CID name, agent finds the code

### Key components to showcase:
1. `<Identified>` — any element gets a data-cid
2. `<SiteSection>` — structural sections with landmarks
3. Dev panel — floating overlay showing all CIDs in current view
4. Context footer — every modal shows its own CID for self-referential editing
5. Search dialog — find any CID across the page
6. Quick prompt — select CID + action → instant agent prompt

## Act 3: The GAD Loop (1-2 min)

- Terminal: `gad snapshot --projectid get-anything-done`
- Show the output: state, tasks, phases, decisions, skills
- Pick a task from the registry
- Implement it (quick edit using a CID reference)
- Update planning docs
- Commit
- "That's the loop. Every task, every agent, every time."

## Act 4: Skills — Making It Portable (2-3 min)

- Show the VCS skill file: `visual-context-system.md`
- "This skill teaches any agent how to build the VCS in any project"
- Show the escape-the-dungeon vcs-test species
- Run the generation: `gad species run escape-the-dungeon --species vcs-test`
- (Pre-recorded) Show the agent building VCS in a KAPLAY canvas game
- Show the result: dev panel working in a game, CIDs on game elements
- "Same skill, different project, same agent-addressability"

## Act 5: The Minimal Surface (1 min)

- Recap the primitives:
  1. Identity literals (string constants in source)
  2. A registry (Map of cid → kind + label)
  3. A dev panel (toggleable, lists CIDs, click-to-copy)
  4. A naming convention (scene-section-detail)
- "Four things. That's it. Any framework, any renderer."
- "The skill file is the recipe. The species carries it. The generation builds it."

## Closing

- "GAD: Get Anything Done. Structured workflows, measurable results."
- Link to quickstart, GitHub, downloads

## Production notes

- Record on Windows (first-class platform)
- Use the actual GAD site for Act 2
- Pre-record the eval generation for Act 4 (takes minutes to run)
- Voice-over with screen capture
- Could be a Remotion composition later (registered in registry.ts)
