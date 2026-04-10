# Escape the Dungeon — Bare

> Build a roguelike dungeon crawler with ZERO framework assistance. Just requirements and freedom.

## What is this?

This is a **starter project** for the [Escape the Dungeon — Bare](https://get-anything-done.vercel.app) eval condition. It contains everything an AI coding agent needs to build the project from scratch:

| What's included | Purpose |
|---|---|
| `AGENTS.md` | Workflow instructions for the agent |
| `REQUIREMENTS.xml` | The full requirements spec (v5) |
| `.planning/` XML | Not included — bare starts cold |
| `skills/` | Bootstrap only: create-skill + find-sprites |

**Hypothesis tested:** Freedom hypothesis — less framework constraint leads to better creative output

## Quick start

### Option 1: Claude Code
```bash
git clone https://github.com/MagicbornStudios/escape-the-dungeon-bare.git
cd escape-the-dungeon-bare
```

Then open in Claude Code and say:

> "Build this project. Read AGENTS.md first, then REQUIREMENTS.xml. Follow the instructions exactly. When you're done, serve the build so I can play it."

### Option 2: Cursor
Open the cloned directory in Cursor. In the chat, say:

> "I want you to build a project based on the AGENTS.md and REQUIREMENTS.xml files in this repo. Read them carefully and implement everything they ask for. Serve the result when done."

### Option 3: Codex CLI
```bash
git clone https://github.com/MagicbornStudios/escape-the-dungeon-bare.git
cd escape-the-dungeon-bare
codex exec "Read AGENTS.md and REQUIREMENTS.xml. Build the project they describe. Serve it when done."
```

### Option 4: Any other coding agent
The files are plain markdown and XML. Any agent that can read files and write code can use them. Just point it at `AGENTS.md` first.

## What the agent should produce

A playable build that satisfies the requirements. The agent should:

1. Read `AGENTS.md` for workflow instructions
2. Read `REQUIREMENTS.xml` for the full spec
3. Build the project (the requirements specify the stack)
4. Serve it locally so you can play/view it
5. The build should pass all gate criteria in the requirements

## Live demo[**Play the latest build →**](https://get-anything-done.vercel.app/playable/escape-the-dungeon-bare/v5/index.html)> Built by a coding agent against these exact template files. No human code edits.

## See the demos

Builds from previous rounds are playable in your browser:

- [https://get-anything-done.vercel.app/#play](https://get-anything-done.vercel.app/#play) — Playable archive with every scored build
- [https://get-anything-done.vercel.app/hypotheses](https://get-anything-done.vercel.app/hypotheses) — What we're testing and why
- [https://get-anything-done.vercel.app/skeptic](https://get-anything-done.vercel.app/skeptic) — Our honest critique of our own claims

## Part of the GAD research framework

This starter is one condition in a [5-condition experimental matrix](https://get-anything-done.vercel.app/methodology) testing how AI coding agents perform under different levels of scaffolding. See the [full template matrix](https://get-anything-done.vercel.app/methodology#what-each-condition-template-contains) for what each condition gets.

**Main repo:** [https://github.com/MagicbornStudios/get-anything-done](https://github.com/MagicbornStudios/get-anything-done)
**Site:** [https://get-anything-done.vercel.app](https://get-anything-done.vercel.app)
**Install GAD skills:** `npx skills add MagicbornStudios/get-anything-done`

## Scoring

After the agent finishes, you can score the result:

```bash
# Install GAD CLI
npx get-anything-done

# Submit a rubric review
gad eval review escape-the-dungeon-bare v1 --rubric '{"playability": 0.8, "ui_polish": 0.7, "mechanics_implementation": 0.8, "ingenuity_requirement_met": 0.7, "stability": 0.6}' --notes "Your observations here"
```

See [https://get-anything-done.vercel.app/rubric](https://get-anything-done.vercel.app/rubric) for the full scoring dimensions.

---

*Built with [Get Anything Done](https://github.com/MagicbornStudios/get-anything-done) — a system for evaluating and evolving agents through real tasks, measurable pressure, and iteration.*
