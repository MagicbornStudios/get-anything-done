---
id: h-2026-04-18T20-20-30-get-anything-done-55
projectid: get-anything-done
phase: 55
task_id: attribution-reject
created_at: 2026-04-18T20:20:30.881Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: high
estimated_context: mechanical
runtime_preference: codex
---
# Attribution-quality reject — small, ships independently of evolution wiring

Single-commit pickup. Unblocks skill usage-stats quality before anything else evolution-related runs.

## The bug

`gad tasks release --done --skill <x>` silently accepts `default` / `none` / `-` / `unknown` / empty string. Result: 162 of 212 historical task attributions have `skill="default"` (confirmed by `lib/skill-usage-stats.cjs` against the get-anything-done TASK-REGISTRY). Data is noise; shedding / evolution scans can't trust it.

See `lib/skill-usage-stats.cjs` → `SENTINEL_SKILL_VALUES = new Set(['default', 'none', '-', 'unknown'])` for the canonical list to reject.

## Implementation

File: `bin/gad.cjs` — find `tasksReleaseCmd` (grep \`const tasksReleaseCmd\`). In the args handling, after parsing `--skill`:

```js
const { SENTINEL_SKILL_VALUES } = require('../lib/skill-usage-stats.cjs');
const skillArg = String(args.skill || '').trim();
if (skillArg && SENTINEL_SKILL_VALUES.has(skillArg.toLowerCase()) && !args['no-skill']) {
  outputError(
    \`skill=\"\${skillArg}\" is a sentinel, not a real skill. Either:\n\` +
    \`  - Pass --skill <real-skill-id> (gad skill list for valid options)\n\` +
    \`  - Pass --no-skill if no skill was used (writes empty skill attr)\`
  );
  process.exit(1);
  return;
}
```

Add `no-skill` flag to the args schema: `'no-skill': { type: 'boolean', default: false }`.
If `args['no-skill']` is set, normalize `args.skill = ''` so the downstream writer writes `skill=""` (the existing tolerated empty value).

## Tests

`tests/tasks-release-skill-reject.test.cjs`:

```js
test('rejects skill=default', () => {
  const out = spawnCli(['tasks', 'release', '01-01', '--projectid', PROJ, '--done', '--skill', 'default']);
  assert.equal(out.exitCode, 1);
  assert.match(out.stderr, /sentinel/);
});

test('accepts --no-skill escape hatch', () => {
  const out = spawnCli(['tasks', 'release', '01-02', '--projectid', PROJ, '--done', '--no-skill']);
  assert.equal(out.exitCode, 0);
  // read TASK-REGISTRY, confirm skill=\"\" on 01-02
});

test('accepts a real skill id', () => {
  const out = spawnCli(['tasks', 'release', '01-03', '--projectid', PROJ, '--done', '--skill', 'execute-phase']);
  assert.equal(out.exitCode, 0);
});
```

## Acceptance

- \`gad tasks release 01-01 --done --skill default\` exits 1 with the sentinel error message.
- \`gad tasks release 01-01 --done --no-skill\` exits 0, writes \`skill=\"\"\`.
- \`gad tasks release 01-01 --done --skill execute-phase\` unchanged.
- Case-insensitive: \`--skill DEFAULT\` also rejects.
- No existing test regresses.

## When done

\`gad handoffs complete <this-id>\`. Post the installed-binary version sha in the completion note so I know when the fix is in a `gad install` build — backfill-attribution subagent can't run until operators have the reject live.