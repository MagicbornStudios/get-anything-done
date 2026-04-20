# gad team — mailbox-based multi-agent orchestration (design)

**Date:** 2026-04-20
**Context:** Operator directive 2026-04-20 — absorb OMX team/worker functionality into gad, rebrand under `.planning/team/`, no `.omx/` writes, no OMX CLI calls. All observable through `gad` CLI. See memory `project_omx_keep_list.md` for what OMX capabilities are load-bearing.

## Goals

1. Operator runs `gad team start --n 3` → three worker loops come up.
2. Operator talks to their main Claude/Codex session creating tasks, phases, decisions, handoffs as normal.
3. When a handoff is open and no one is mid-task on it, a worker picks it up automatically.
4. When a worker's subprocess hits the 80%-context mark, the hook fires, the subprocess files a resume handoff and exits. The worker's next loop iteration claims the next handoff (could be the same one it just paused, possibly in a different worker).
5. `gad team status` shows what every worker is doing at a glance.
6. Nothing under `.omx/`. No `omx` CLI calls. Mailbox and state live under `.planning/team/`.

## Non-goals for tomorrow

- **Not** building a context-preserving persistent Claude session per worker. Each worker spawns a **fresh subprocess per task/handoff**. Clean context every task. Pause → resume handles tasks that overflow one subprocess.
- **Not** providing our own LLM gateway. Workers invoke the CLI the operator already has (`claude`, `codex`). Runtime is a config knob.
- **Not** building a full TUI tonight. `gad team status` prints a table; live observation can use `tail -f .planning/team/workers/<id>/log.jsonl` until gad-tui lands a team panel.

## Directory layout

```
.planning/team/
  config.json                  # { workers: N, roles[], autopause_threshold, created_at, supervisor_pid }
  supervisor.log.jsonl         # enqueue / spawn / shutdown events
  dispatch.seq                 # monotonic counter for mailbox filenames
  workers/
    w1/
      status.json              # { id, role, runtime, pid, started_at, last_heartbeat, current_ref, state }
      mailbox/
        0001-h-2026-04-20T00-30-foo.msg.json
      log.jsonl                # worker activity stream
      out/                     # per-attempt prompts + CLI stdout/stderr (transient, safe to gc)
      stop.flag                # presence = worker should exit after current iteration
    w2/...
```

Nothing under `.omx/`. Everything gad-branded. `.planning/` is already gad's canonical planning root.

## Mailbox message schema

```json
{
  "kind": "handoff" | "task",
  "ref": "h-2026-04-20T00-30-00-get-anything-done-63" or "42.2-20",
  "projectid": "get-anything-done",
  "priority": "critical" | "high" | "normal" | "low",
  "runtime_preference": "claude-code" | "codex-cli" | null,
  "enqueued_at": "2026-04-20T00:45:12Z",
  "enqueued_by": "supervisor" | "<agent-name>"
}
```

Workers read the full body from the canonical source (`.planning/handoffs/<bucket>/<id>.md` or `.planning/TASK-REGISTRY.xml`) on claim. The message is a claim ticket, not the payload.

## Worker state machine

```
IDLE → CLAIMING → WORKING → (COMMITTING) → IDLE
                       ↓
                    PAUSED (context autopause or explicit pause-work)
                       ↓ (handoff filed)
                     IDLE
```

Heartbeat every tick (2s) updates `status.json::last_heartbeat`. Supervisor treats worker as dead if `now - last_heartbeat > 30s` + no log output.

## CLI surface (`gad team ...`)

| Command | Behavior |
|---|---|
| `gad team start --n 3 [--roles executor,executor,reviewer] [--runtime claude-code]` | Writes `.planning/team/config.json`, spawns N worker loops, prints their IDs. |
| `gad team stop [--worker-id w1 / --all]` | Writes `stop.flag` in target(s). Workers exit after current iteration. |
| `gad team status [--json]` | Table: id, role, state, mailbox depth, current ref, heartbeat age. |
| `gad team enqueue (--task ID \| --handoff ID) [--worker-id w1] [--priority high]` | Drops a `.msg.json` into target worker's mailbox. If no worker given, round-robin to least-loaded. |
| `gad team dispatch [--once]` | Scans open handoffs; for each one not currently in any mailbox, picks the best compatible worker (runtime_preference + load) and enqueues. `--once` = run once and exit; default = loop with file watcher. |
| `gad team work --worker-id w1 [--runtime claude-code]` | Worker loop entry. Intended to run inside a tmux pane or detached terminal. Sets `GAD_TEAM_WORKER_ID` + `GAD_AGENT_NAME=team-w1`. Polls mailbox → claims → spawns subprocess → logs → loops. |

## Worker loop pseudocode

```js
// gad team work --worker-id w1
setEnv('GAD_TEAM_WORKER_ID', 'w1');
setEnv('GAD_AGENT_NAME', 'team-w1');
writeStatus({ id: 'w1', state: 'IDLE', pid: process.pid, ... });

while (!fs.existsSync('.planning/team/workers/w1/stop.flag')) {
  heartbeat();
  const msg = pollMailbox('w1');   // returns oldest .msg.json, atomic rename to .claimed
  if (!msg) { sleep(2000); continue; }

  writeStatus({ ...last, state: 'CLAIMING', current_ref: msg.ref });
  const body = resolveBody(msg);   // reads handoff or task record

  writeStatus({ ...last, state: 'WORKING' });
  const prompt = composePrompt(body, { workerId: 'w1', projectid: msg.projectid });
  fs.writeFileSync('.../out/ts.prompt.md', prompt);

  const { exitCode, stdout, stderr } = spawnSubprocess(
    runtimeCmd,                    // `claude -p <prompt>` or `codex -p <prompt>`
    { env: { ...process.env, GAD_TEAM_WORKER_ID: 'w1' }, timeout: 30 * 60 * 1000 }
  );

  appendLog({ ts, kind: 'task-complete', ref: msg.ref, exitCode });
  deleteMailboxMsg(msg);           // claimed-and-done

  writeStatus({ ...last, state: 'IDLE', current_ref: null });
}
writeStatus({ state: 'STOPPED' });
```

Key details:
- Fresh subprocess per mailbox item → no context leak between tasks.
- `GAD_TEAM_WORKER_ID` env triggers the existing `gad-context-monitor.js` autopause branch (wired 2026-04-20).
- If the subprocess exits non-zero, the worker logs and moves on — does NOT retry automatically. Supervisor or operator decides what to do with the failed ref.

## Dispatch / auto-pickup

Two modes:

1. **Interval-based** (simple): `gad team dispatch` runs in a loop with 5-second tick, scans `.planning/handoffs/open/`, assigns new ones.
2. **File-watcher** (preferred once stable): chokidar-lite watches `.planning/handoffs/open/` — on create event, fire `dispatchOnce()`.

Dispatch logic:
- `listHandoffs({ bucket: 'open' })` → sort with `sortHandoffsForPickup(list, null)` (null = agnostic)
- For each handoff not already in any worker's mailbox, pick the best-match worker via runtime preference + current load (mailbox depth + state).
- Drop `.msg.json` into winner's mailbox. Record in `supervisor.log.jsonl`.

## Spawn layer

Tier 1 (portable): **detached node subprocess** per worker.
- `spawn('node', ['bin/gad.cjs', 'team', 'work', '--worker-id', id], { detached: true, stdio: ['ignore', logFd, logFd] })`.
- Pid captured in `status.json`. Kill via `process.kill(pid, 'SIGTERM')`.
- Observer runs `tail -f .planning/team/workers/<id>/log.jsonl` in any terminal.

Tier 2 (if tmux available): wrap the Tier 1 spawn inside `tmux new-window` so the operator has a live pane.
- Detect with `command -v tmux` at `gad team start` time.
- `tmux new-session -d -s gad-team` + `tmux new-window -t gad-team -n w1 'gad team work --worker-id w1'`.

Tier 3 (Windows Terminal): `wt.exe -w 0 nt --title worker-w1 gad team work --worker-id w1`. Only if `wt.exe` on PATH and operator opts in via `--windows-terminal`.

MVP ships Tier 1 only. Tmux / wt wrappers are post-MVP.

## Interaction with existing gad handoffs

Zero schema change to `.planning/handoffs/`. Workers use the existing `gad handoffs claim-next` as the underlying action; the mailbox is a **queue of work assignments on top of** the handoff queue.

Flow:
1. Operator (or any agent) creates a handoff via `gad handoffs create` or `gad pause-work`.
2. Dispatcher sees it, assigns to worker w1 by writing to `w1/mailbox/`.
3. w1 pops mailbox, calls `gad handoffs claim --agent team-w1` (NOT `claim-next`, the dispatcher already picked it), moves handoff to `claimed/`.
4. w1 spawns Claude/Codex with the claimed body.
5. Completion writes a commit + optionally `gad handoffs complete`. `handoffs/closed/`.

If the subprocess hits autopause: it files a NEW handoff via `gad pause-work` and exits. Dispatcher picks it up next tick, possibly giving it back to w1 or to a different worker. No state is lost — the new handoff captures goal + last commit + what's left.

## Milestones

- **M1 (tonight):** design doc (this), CLI skeleton (`bin/commands/team.cjs` stubbed), dispatcher registered in `bin/gad.cjs`. `gad team --help` renders.
- **M2 (tomorrow):** real spawn (Tier 1), worker loop, enqueue + status, dispatch loop without watcher.
- **M3:** file-watcher dispatch, tmux wrapper, `gad-tui` team panel.
- **M4:** absorb OMX ralph/ultrawork semantics as role modes (`--roles ralph,executor`); decommission OMX install from gad.

## Out of scope (filed as follow-ups)

- LSP code-intel integration (keep OMX `code_intel` MCP for now; gad-native version later).
- Per-worker model selection (default = env `GAD_TEAM_MODEL`, override per-role in M2+).
- Cost tracking / token budgets per worker (M3+).
- Worker supervision loop (auto-restart crashed workers) — MVP leaves dead workers dead; operator restarts.
