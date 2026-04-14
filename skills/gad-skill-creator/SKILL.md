---
name: gad-skill-creator
description: >-
  Create a GAD skill autonomously by feeding context to Anthropic's canonical
  skill-creator. Use when something in the GAD workflow should become a reusable
  skill — a repeated CLI sequence, a recurring decision pattern, a candidate
  emitted by `gad:evolution:evolve`, or a direct user request like "make a skill
  for X". This skill is a thin wrapper: it ensures the canonical skill-creator
  is installed, packages full project context (phase, tasks, decisions, file
  refs, CLI surface, related skills) into an INTENT.md file, and hands it to
  skill-creator so the user never needs to sit through a Q&A interview. Triggers
  on "make a skill for", "create a skill", "we need a skill that", "turn this
  into a skill", "promote this candidate to a skill", or whenever a completed
  task reveals a reusable pattern worth capturing.
---

# gad-skill-creator

A thin wrapper around Anthropic's canonical
[skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator)
that makes it work autonomously inside the GAD loop.

The canonical skill-creator is comprehensive — subagent-based test runs, grading,
benchmarking, HTML viewer, description optimization. We don't reinvent any of
that. We just **bypass its user interview** by feeding it a complete `INTENT.md`
context file derived from the GAD planning artifacts, then **preserve its
output** for the GAD site.

## When to use

- A user explicitly asks to create / promote / refine a skill.
- `gad:evolution:evolve` produced a candidate and you're invoked to flesh it out.
- You hit a repeated CLI pattern across 3+ tasks and the user agrees it's a skill.
- A bug or workaround is non-obvious enough that future agents will hit it.

## When NOT to use

- The pattern is one-off and won't recur.
- The thing belongs in the GAD CLI itself (it would be a command, not a skill).
- An existing skill already covers this — use `gad:merge-skill` or update in place.

## Step 1: Ensure canonical skill-creator is installed

Idempotent — only installs if missing:

```sh
if [ ! -d "$HOME/.agents/skills/skill-creator" ]; then
  npx --yes skills add anthropics/skills --skill skill-creator --global --yes
fi
```

After install, `~/.agents/skills/skill-creator/SKILL.md` is the canonical source.
Read it once for the full surface — this wrapper only handles the input/output
plumbing.

## Step 2: Build the INTENT.md context payload

Skill-creator's first step ("Capture Intent") is normally a user interview.
We replace that with an INTENT.md file the skill-creator reads instead.

The INTENT.md location depends on where you're invoked from:

- **From `gad:evolution:evolve`:** `skills/candidates/<slug>/INTENT.md` (already
  exists — evolve wrote it).
- **From a direct user request:** scratch dir like
  `skills/candidates/<proposed-slug>/INTENT.md`.
- **From a "promote this candidate" request:** the existing INTENT.md in the
  candidate dir.

INTENT.md format (this is everything skill-creator's interview would have asked):

```markdown
---
status: candidate
source_phase: <phase-id or null>
source_phase_title: <title or null>
pressure_score: <number or null>
evolution_id: <YYYY-MM-DD-NNN or null>
created_on: <YYYY-MM-DD>
created_by: gad-skill-creator | gad-evolution-evolve
proposed_name: <kebab-skill-name>
---

# Intent: <proposed-skill-name>

## What this skill should do
<derived from phase tasks or user request — the recurring pattern in 1-2 paragraphs>

## When it should trigger
- <user-facing trigger 1>
- <user-facing trigger 2>
- Specific phrases users might say: "...", "...", "..."

## Expected output format
<what a successful invocation produces — file changes, CLI output, side effects>

## Test prompts skill-creator should use
1. <realistic user prompt drawn from a real task>
2. <another realistic prompt with different phrasing>
3. <a should-NOT-trigger negative case from an adjacent area>

## Files this skill cares about
- <path>: <one-line reason>

## Decisions backing this skill
- <decision-id>: <one-line summary>

## CLI surface available
<paste relevant lines from `gad --help` and `gad <subcommand> --help`>

## Existing related skills
- <skill-id>: <one-line reason it's adjacent but not the same thing>

## Errors / failed attempts observed
<from logs, git history, or the source phase's task notes — what didn't work>
```

When you're filling INTENT.md from a phase, draw the test prompts from real
tasks in that phase. The whole point is that skill-creator gets enough realistic
context to write good evals without asking.

## Step 3: Invoke canonical skill-creator on the INTENT

Skill-creator expects a conversational entry point. Give it a single message
that points it at INTENT.md and tells it to skip the interview:

```
You are the canonical skill-creator. Read skills/candidates/<slug>/INTENT.md
for the full intent — it replaces the user interview. Then:

1. Write skills/candidates/<slug>/SKILL.md following your normal anatomy.
2. Write skills/candidates/<slug>/evals/evals.json with the test prompts from
   INTENT.md plus assertions you draft.
3. Run your full test loop in skills/candidates/<slug>/skill-creator-workspace/
   — spawn with-skill and baseline subagents in parallel, grade, aggregate,
   benchmark.
4. Generate the eval viewer with --static
   skills/candidates/<slug>/viewer.html so a human can review it later
   without a running server.
5. STOP after the viewer is generated. Do NOT iterate. Do NOT prompt the user
   to continue. The human review is asynchronous — they will open viewer.html
   in a browser, review, and either promote or discard the candidate via the
   gad CLI later.
```

The `--static` flag is critical — it makes skill-creator headless-compatible,
which is what we need for the autonomous GAD loop. The viewer becomes a self-
contained HTML file we can serve from the site or open locally.

## Step 4: Preserve outputs for the GAD site

After skill-creator finishes, copy the structured output into a known location
the GAD site's build pipeline can find:

```sh
SKILL_OUTPUT="skills/candidates/<slug>"
mkdir -p "$SKILL_OUTPUT/_skill-creator-output"
cp -r "$SKILL_OUTPUT/skill-creator-workspace" "$SKILL_OUTPUT/_skill-creator-output/workspace"
[ -f "$SKILL_OUTPUT/viewer.html" ] && cp "$SKILL_OUTPUT/viewer.html" "$SKILL_OUTPUT/_skill-creator-output/viewer.html"
[ -f "$SKILL_OUTPUT/skill-creator-workspace/iteration-1/benchmark.json" ] && \
  cp "$SKILL_OUTPUT/skill-creator-workspace/iteration-1/benchmark.json" "$SKILL_OUTPUT/_skill-creator-output/benchmark.json"
```

`build-site-data.mjs` reads `_skill-creator-output/` to surface candidate
benchmarks, viewer HTML, and per-eval results on the GAD site's evolution view.

## Step 5: Hand off to human review

Print a clear handoff message to the user with the viewer path and what to do
next:

```
Skill candidate ready for review:
  skills/candidates/<slug>/SKILL.md
  skills/candidates/<slug>/viewer.html

Open the viewer in a browser, click through each test case, leave feedback,
and click Submit All Reviews. When the feedback.json drops into the candidate
dir, run:

  gad evolution promote <slug>      # to merge into skills/
  gad evolution discard <slug>      # to delete the candidate
```

The candidate stays in `skills/candidates/` until promoted or discarded.
`gad:evolution:evolve` will refuse to start a new evolution while any pending
candidates remain — this is the human-review gate.

## Failure modes

- **Skill-creator interviewing the user anyway:** make sure the INTENT.md is
  complete and your prompt explicitly says "skip the interview." Skill-creator
  defers to user input when context is thin, so a sparse INTENT.md will trigger
  questions.
- **Viewer not generating:** check that `--static` was passed. Without it,
  skill-creator tries to launch a browser, which fails in headless GAD runs.
- **Workspace pollution in git:** `_skill-creator-output/workspace/` can be
  large. Add `skills/candidates/*/skill-creator-workspace/` to .gitignore and
  only commit `_skill-creator-output/` (which is the trimmed, site-ready copy).

## Reference

- Canonical skill-creator: `~/.agents/skills/skill-creator/SKILL.md`
- Anthropic skills repo: https://github.com/anthropics/skills
- Related skills: `gad-evolution-evolve`, `gad-merge-skill`, `gad-find-skills`

