# Instructions for GAD

- Use GAD only when the user explicitly asks for GAD, `gad-*`, or `/gad-*` workflows.
- Treat `/gad-*` or `gad-*` as command invocations and load the matching skill from `.github/skills/gad-*` when available.
- When a workflow says to spawn a subagent, prefer a matching custom agent from `.github/agents`.
- Do not assume the framework source repo is present. Prefer installed skills, installed agents, and the `gad` CLI on `PATH`.
- After completing a GAD command or deliverable, summarize what was done and suggest the next relevant GAD step. Do not force an interactive loop.
