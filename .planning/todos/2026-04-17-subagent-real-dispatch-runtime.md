# Real subagent dispatch runtime — replace prompt-emit-only with spawned child (follow-up to 59-07)

**Source:** phase 59 task 59-07 (2026-04-17) shipped option (Y) prompt-emit-only. A second task (candidate id 59-07a or phase 61 task 61-01) picks up the runtime-dispatch half.

## Scope

`lib/subagent-dispatch.cjs` currently writes a prompt file + run-record stub and prints the prompt path. An operator (or a cron-ish wrapper) then has to actually run the subagent. The goal of this todo is to replace that operator step with a CLI runtime invocation.

## Integration point (already flagged inline)

In `vendor/get-anything-done/lib/subagent-dispatch.cjs` the `dispatchOne` function has a comment block labeled `// FOLLOW-UP (task 59-07a …)` that shows the drop-in shape:

```js
const { scopedSpawn } = require('./scoped-spawn.cjs');
const child = await scopedSpawn({
  projectId: project.id,
  command: runtimeCmd,                       // e.g. 'claude-code' or a wrapper script
  args: ['--prompt-file', promptPath, '--report-back', recordPath],
});
// wire child.on('exit') → update the run-record to status=done|failed,
// populate reportBody/teachingTipId/nextTaskId from parsed report block.
```

That is where the real integration goes. `scoped-spawn.cjs` already does BYOK env injection (decision gad-266 G) so the subagent sees the project's OPENAI_API_KEY / ANTHROPIC_API_KEY etc. without the main session leaking them.

## Config surface needed

Per-root field in `gad-config.toml`:
  - `dailySubagentRuntime = "claude-code"` — CLI binary to spawn
  - `dailySubagentRuntimeArgs = ["--model=sonnet"]` — optional extra args

Or a repo-level `[subagent]` table if the same runtime is shared across projects.

## Report-parsing contract

The prompt template (see `buildPromptBody` in subagent-dispatch.cjs) asks the subagent to emit one fenced block:

```
STATUS: done | blocked | partial
FILES TOUCHED: <list>
ONE-LINE OUTCOME: <single sentence>
TEACHING TIP: <one insight worth authoring as a static tip; see llm-004>
NEXT TASK: <next task id in this phase, or "(phase complete)">
COMMIT: <short sha>
```

A small parser in `lib/subagent-report-parser.cjs` should convert that block into the missing run-record fields (`endedAt`, `status`, `reportBody`, `oneLineOutcome`, `teachingTipId`, `nextTaskId`, `commitSha`). Rewrite the `.json` file atomically (`.tmp` + rename) when the child exits.

## Risks to watch

1. **Child runaway.** Need a per-run timeout (default ~30 min?) and SIGTERM-then-SIGKILL escalation.
2. **Concurrent dispatch of the same project.** If a user runs `gad subagents dispatch` twice before the first child finishes, both could see a `.json` stub with `status=pending-dispatch` and nothing else — the skip-already-ran check today is just filename-presence. For real dispatch, also check `status !== 'pending-dispatch'` before treating as "handled". Or add an advisory pidfile inside the run record.
3. **Report parsing brittleness.** LLMs sometimes wrap the fenced block in extra prose. Parser should be forgiving: find the first block containing `STATUS:` and parse from there.
4. **Commit discipline inside the subagent.** The subagent must commit before emitting the report so the COMMIT sha is real. Prompt already instructs this; enforce by verifying `commitSha` looks like a sha.

## Related decisions

- gad-258: subagent execution model (canonical)
- gad-262: `gad start` host command
- gad-266 G: scoped-spawn merge default
- gad-267: security patterns → teaching tips (the TEACHING TIP field harvest feeds this)

## Acceptance criteria for the follow-up task

- `gad subagents dispatch --projectid llm-from-scratch` actually runs a child and waits for it.
- The child updates the run-record to `status=done` with `reportBody` populated before exit.
- `gad start --dispatch-subagents` runs N children in parallel (or serial with a flag).
- Timeout + failure modes covered in tests (child exits non-zero, child emits no report, child hangs past timeout).
