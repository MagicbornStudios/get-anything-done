---
id: h-2026-04-18T23-41-06-get-anything-done-63
projectid: get-anything-done
phase: 63
task_id: startup-no-side-effects-clean-worktrees
created_at: 2026-04-18T23:41:06.742Z
created_by: unknown
claimed_by: unknown
claimed_at: 2026-04-19T00:08:16.710Z
completed_at: 2026-04-19T00:20:18.167Z
priority: high
estimated_context: reasoning
runtime_preference: codex
---
# gad startup writes side-effect artifacts in clean worktrees — blocks release commits

## Symptom

Codex (2026-04-18, building bun-compiled binary in a clean worktree intended for the release commit) observed:

> startup generated planning/session artifacts in the clean worktree, which cannot go into the release commit. I'm cleaning those back out so the commit stays exactly version files plus changelog.

This is a multi-agent ergonomics bug. Any agent running \`gad startup\` (or anything that triggers the startup side-effect chain) inside a clean worktree pollutes it with files that must be excluded from the release commit. Manual cleanup before every release = friction tax that compounds across the fleet.

## Root cause (suspected)

\`gad startup\` (and likely \`gad snapshot\` too) writes to:
- \`.planning/.gad-log/<date>.jsonl\` (CLI call log)
- \`.planning/.trace-events.jsonl\` (hook-driven trace)
- \`.planning/.trace-seq\` (sequence counter)
- \`.planning/sessions/<id>.json\` (session state)
- \`.planning/.gad-agent-lanes.json\` (current claims)
- Possibly \`.planning/STATE.xml\` last-updated timestamp on certain code paths

These are append-only / mutated-on-every-call infrastructure files. They make sense in the operator's main worktree where they're durable runtime telemetry, but in a transient release worktree they're noise.

## Fix shape

Two complementary fixes:

### 1. Detect 'release worktree' mode and suppress side-effects

A worktree is in 'release mode' when:
- It's a git worktree (\`git rev-parse --is-inside-git-dir\` says yes AND the wt is not the primary)
- AND/OR an env opt-out is set: \`GAD_NO_SIDE_EFFECTS=1\` or \`GAD_RELEASE_BUILD=1\`
- AND/OR a marker file exists at worktree root: \`.gad-release-build\`

When release mode is detected, every write site in \`bin/gad.cjs\` + \`lib/runtime-*.cjs\` should:
- skip if write would create a new file under \`.planning/\` (no \`.gad-log\`, no \`sessions/\`, no \`.gad-agent-lanes.json\`, no \`.trace-events.jsonl\`, no \`.trace-seq\`)
- skip mutations to \`STATE.xml\` last-updated unless the session is genuinely doing planning work

### 2. CLI flag for one-shot suppression

\`gad startup --no-side-effects --projectid <id>\` runs the read-only orientation pass, never writes. Simple. Composable with the env-var opt-out.

## Tests

Add \`tests/startup-side-effects.test.cjs\`:

\`\`\`js
test('gad startup --no-side-effects writes nothing under .planning/', () => {
  const tmp = createTempProject('release-build-');
  // setup minimal STATE.xml + ROADMAP.xml
  const before = snapshotPlanningDirContents(tmp);
  runGadCli(['startup', '--projectid', 'sample', '--no-side-effects'], tmp);
  const after = snapshotPlanningDirContents(tmp);
  assert.deepEqual(before, after, 'no .planning/ files should be created or modified');
});

test('GAD_NO_SIDE_EFFECTS=1 env triggers same behavior', () => {
  // ... same shape, env-driven
});

test('Release-marker file .gad-release-build at root triggers same behavior', () => {
  // ... same shape, marker-driven
});
\`\`\`

## Why high priority

- Multi-agent fleet: cursor + claude-code + you + opencode all sometimes operate in clean worktrees. Each one hitting this = manual cleanup or a polluted release commit.
- Just landed bun build (64.A); the bun-build CI workflow (64.E) will run \`gad startup\` in a clean checkout to validate — without this fix, the workflow fails or commits noise.
- Trivial fix surface; high payoff.

## Acceptance

- \`gad startup --no-side-effects --projectid get-anything-done\` runs, prints contract, exits 0, modifies zero files under \`.planning/\` (verified via \`git diff --quiet .planning/\` post-call).
- \`GAD_NO_SIDE_EFFECTS=1 gad startup --projectid <id>\` same behavior.
- \`.gad-release-build\` marker at worktree root same behavior.
- All three cases tested.
- \`gad snapshot\` gets the same opt-outs (snapshot is read-mostly but does write hud-state etc.).

## When done

\`gad handoffs complete <this-id>\`. Post:
- The exact env/flag/marker triple to use.
- Expected to integrate into 64.E CI workflow (claude lane will pick up that wire-in once you confirm the contract).

## Signed
— Kael of Tarro / claude-code, 2026-04-18 fleet-startup