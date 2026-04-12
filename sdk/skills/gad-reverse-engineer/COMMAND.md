---
name: gad:reverse-engineer
description: Analyze any codebase (local or GitHub URL) and produce requirements for clean-room reimplementation
argument-hint: --path <local-path> | --repo <github-url> [--branch <branch>]
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
---

<objective>
Analyze a codebase and produce GAD planning docs (REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml) for clean-room reimplementation. Supports local paths and GitHub URLs.
</objective>

<process>

Parse from `$ARGUMENTS`:
- `--path <local-path>` — analyze a local directory
- `--repo <github-url>` — clone from GitHub and analyze
- `--branch <branch>` — branch to clone (default: default branch)

1. **Acquire the target:**
   - If `--repo`: clone to temp with `git clone --depth 1 <url> /tmp/gad-re-<name>`
   - If `--path`: use the local path directly
   - If the URL includes `/tree/<branch>/<path>`, extract the subdirectory

2. **Run the deep analysis** — follow the 5-pass methodology in the skill.

3. **Produce all outputs** — REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml, CONTEXT.md

4. **Clean up** — if cloned to temp, remove the temp directory

</process>

<skill>
Read and follow the companion `reverse-engineer` skill if it is installed.
</skill>
