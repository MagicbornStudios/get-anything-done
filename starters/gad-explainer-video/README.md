# GAD Explainer Video

> Build a 30-second Remotion video that explains the GAD framework with motion graphics.

## What is this?

A **starter project** for the GAD explainer video eval. The agent builds a Remotion composition (TypeScript + React) that renders a 30-second explainer video with 4 mandatory gate frames.

| What's included | Purpose |
|---|---|
| `AGENTS.md` | Build instructions for the agent |
| `REQUIREMENTS.md` | The full video spec (v1, 30s max, 4 gate frames) |

**Hypothesis tested:** Does the freedom hypothesis generalize beyond game development?

## Quick start

### Claude Code
```bash
git clone https://github.com/MagicbornStudios/gad-explainer-video.git
cd gad-explainer-video
npm init -y && npm install remotion @remotion/cli @remotion/player react react-dom
```

Then say:

> "Build this video. Read AGENTS.md first, then REQUIREMENTS.md. Create a Remotion composition that hits all 4 gate frames in 30 seconds. Render it when done."

### Codex CLI
```bash
git clone https://github.com/MagicbornStudios/gad-explainer-video.git
cd gad-explainer-video
npm init -y && npm install remotion @remotion/cli @remotion/player react react-dom
codex exec "Read AGENTS.md and REQUIREMENTS.md. Build the Remotion video composition they describe. Render it."
```

## See the demos

- [https://get-anything-done.vercel.app/videos](https://get-anything-done.vercel.app/videos) — Remotion player with the current placeholder
- [https://get-anything-done.vercel.app/hypotheses](https://get-anything-done.vercel.app/hypotheses) — What we're testing
- [https://get-anything-done.vercel.app/skeptic](https://get-anything-done.vercel.app/skeptic) — Honest critique

## Part of GAD

**Main repo:** [https://github.com/MagicbornStudios/get-anything-done](https://github.com/MagicbornStudios/get-anything-done)
**Site:** [https://get-anything-done.vercel.app](https://get-anything-done.vercel.app)

---

*Built with [Get Anything Done](https://github.com/MagicbornStudios/get-anything-done) — a system for evaluating and evolving agents through real tasks, measurable pressure, and iteration.*
