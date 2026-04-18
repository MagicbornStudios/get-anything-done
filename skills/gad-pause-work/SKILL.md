---
name: gad:pause-work
description: >-
  Pause work mid-phase by writing a handoff file so the next runner (same agent
  next session, different runtime, or another lane) picks up without losing
  state. Thin wrapper around the canonical gad-handoffs skill — use this verb
  at the END of a work session; use gad-handoffs directly when claiming or
  completing an existing handoff. Supersedes the old .continue-here.md pattern.
lane: dev
allowed-tools:
  - Bash
---

# gad:pause-work

Route to the canonical handoff queue workflow. `pause-work` is the "ending
work" half of the queue's create/consume cycle — this skill exists so the
verb *pause* remains discoverable in `gad skill list`, but the actual
methodology lives in **`skills/gad-handoffs/SKILL.md`**. Read that first.

## The command

```sh
gad handoffs create \
  --projectid <id> \
  --phase <N> \
  --task-id <task-id-you-were-on> \
  --priority <low|normal|high> \
  --context <mechanical|reasoning> \
  --runtime-preference <next-runner's-lane-or-empty> \
  --body "$(cat <<'EOF'
# Short title — <what stopping point>

## Where I am
- Current phase, current task, current commit sha.
- What's done: <bullet points>.
- What's half-done: <files modified but not committed, or half-written>.

## Where to pick up
1. `git status` — see uncommitted work.
2. <next concrete step>.
3. <the test / verify command that confirms completion>.

## Blockers / open questions
- <anything you paused because of a decision needed>.

## When done
`gad handoffs complete <this-handoff-id>` and `gad tasks release <task-id> --projectid <id> --done` if this was the final piece.
EOF
)"
```

## When to prefer this over a commit

- You have uncommitted work and need to stop — commit WIP first, then file
  the handoff so the sha is recoverable.
- You have only committed work but the mental state (decisions-in-flight,
  blockers, "why I stopped") is the hard part — the handoff captures what
  a commit message can't.

## Deprecation note

The earlier `.continue-here.md` pattern is retired. That file was a
single-slot queue that lost content on the next pause. The `gad handoffs`
directory is per-file, append-only (until lifecycle transitions), and
visible to every runtime via one CLI.

## Related

- `skills/gad-handoffs` — canonical handoff queue workflow
- `skills/gad-resume-work` — the consume-side counterpart
- `references/agent-lanes.md` — who owns what when you pass work cross-lane
