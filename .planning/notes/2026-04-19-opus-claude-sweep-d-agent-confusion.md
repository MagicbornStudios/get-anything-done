# Sweep D — agent-confusion surface reduction (2026-04-19)

**Agent:** opus-claude

**Source:** Operator: "any other things that might cause confusion between agents? i dont want agents having to reason too much. make it simple for them to find things and not get confused by other agents in the repo"

Follow-up to sweep B (graph cache) and sweep C (diff-noise full audit). Both prior sweeps reduced **diff churn**; sweep D reduces **decision churn** — the moments where an agent has to stop and reason about which file is canonical, which command is wired, what they themselves changed vs leftover noise, and how to coordinate without stepping on another agent.

## Findings, ranked by ROI

| # | Surface | Symptom | Fix shipped |
|---|---|---|---|
| D-1 | No `.gitattributes` + Windows `core.autocrlf=true` | Every `git status` shows phantom `M` files with zero content diff. Agents can't tell their changes from leftover noise. (16 phantom mods present at audit time.) | `vendor/.gitattributes` + `monorepo/.gitattributes` enforce LF in the index. `git add --renormalize .` once swept the working tree clean. |
| D-2 | No vendor `CLAUDE.md` | Agents working inside the submodule didn't know to invoke `node bin/gad.cjs ...` instead of `gad ...` (the installed binary lags one release). Bit me directly earlier today: patched `gad.cjs`, then tested with `gad`, saw stale behaviour, wasted ~30 min. | `vendor/get-anything-done/CLAUDE.md` — short, submodule-specific. Covers which-`gad`-to-invoke, gitignored derived files, multi-agent conventions, dead-code traps. |
| D-3 | `<next-action>` essay overwrite | 166 STATE.xml commits in 14 days, every one replaces a 1500-char essay with a different 1500-char essay. Lossy across agents; full prior context only recoverable via `git log`. | New `gad state log "<msg>" --tags ... --agent ...` command that **prepends** an `<entry>` to a sibling `<state-log>` block in STATE.xml. Atomic write. `<next-action>` now reserved for "what should the next agent do RIGHT NOW" — short and current. Old essay archived as `<archived-next-action>` for one cycle. |
| D-4 | Duplicate command defs in `bin/gad.cjs` | `snapshotCmd` (dead, line 9356) + `snapshotV2Cmd` (wired, 9651). Same for `tasksCmd`/`tasksV2Cmd`. Bit me earlier: patched the dead V1, smoke test passed against V2, ate 15 min figuring out why my change "didn't take". | Deleted V1 dead code (-361 lines from `bin/gad.cjs`). Renamed V2 → canonical names (no `V2` suffix). Verified dispatcher still wires correctly; smoke tests `gad snapshot --help` + `gad tasks --status planned` pass. |
| D-5 | Notes filename collisions | `.planning/notes/` had **10 same-date files for 2026-04-18**, no agent attribution in filename — can't tell which agent wrote which. | New `gad note add <slug> --title ... --body ... [--agent ...]` command. Filename pattern `YYYY-MM-DD[-<agent>]-<slug>.md`. Agent slug auto-fills from `$GAD_AGENT_NAME` env when not passed. `lib/notes-writer.cjs` extracted as a pure module. |

## Verification

```sh
# D-1: zero phantom mods after renormalize
cd vendor/get-anything-done && git status -s | grep '^ M' | wc -l   # 0

# D-3: append-only state log works
GAD_AGENT_NAME=opus-claude node bin/gad.cjs state log "test" --tags smoke --projectid get-anything-done
head -16 .planning/STATE.xml   # newest entry at top of <state-log>

# D-4: dead V1 gone, V2 wired as canonical
node bin/gad.cjs snapshot --projectid get-anything-done | head -3
node bin/gad.cjs tasks --status planned | head -8

# D-5: agent-slug filename
GAD_AGENT_NAME=opus-claude node bin/gad.cjs note add test-slug --body "x" --projectid get-anything-done
ls .planning/notes/ | grep opus-claude   # 2026-04-19-opus-claude-test-slug.md
```

All pass.

## Gotchas + invariants for future agents

- **Always invoke `node bin/gad.cjs ...` when modifying GAD source.** The installed `gad.exe` is one release behind. CLAUDE.md says this; this note repeats it because it bites.
- **Never `git add` derived files even if `git status` shows them.** The post-2026-04-19 `.gitignore` covers them; if you see something showing up, check `git check-ignore -v <path>` and patch `.gitignore` rather than committing.
- **Use `gad state log` instead of editing `<next-action>` directly.** The block is now meant to be short and current. If you need to record context, that's what the log is for.
- **Use `gad note add <slug>` with `$GAD_AGENT_NAME` set.** Don't `Write` directly to `.planning/notes/` — you'll lose the agent slug and risk same-date collisions.
- **If you see a `Cmd` symbol with a duplicate in `bin/gad.cjs`, check the dispatcher.** Sweep D-4 removed the V1 dupes I knew about; if more turn up, run `grep -nE "^const [a-zA-Z]+Cmd = defineCommand" bin/gad.cjs` and look for repeats.

## Deferred follow-ups (not blocking)

| ID | Description | Why deferred |
|---|---|---|
| sweep-d-handoff-atomicity | `claimHandoff` in `lib/handoffs.cjs` does write-then-rename — race-prone in theory; replace with `O_EXCL` open + atomic `renameSync`. | No incident yet; pattern is mostly safe in single-operator multi-agent context. |
| sweep-d-skill-drift | Skills directories drift across `.cursor/.claude/.codex` (95 / 92 / 115 SKILL.md files). | `pnpm cursor:quiet-skills` already partly addresses; full converge needs design conversation. |
| sweep-d-task-registry-split | `TASK-REGISTRY.xml` is 2168 lines / 450 tasks in one file — every status flip touches the same line range as another agent. | Defer until it actually conflicts in practice; the graph rebuilder reads the whole file and split would complicate that. |
| sweep-d-trace-attribution | Trace events don't have agent attribution; site self-eval mixes data from multiple agents. | Lower-priority cosmetic; self-eval still meaningful aggregate. |
| sweep-d-snapshot-shows-state-log | `gad snapshot` prints entire `STATE.xml` raw — the new `<state-log>` is visible but not formatted. Could surface "last 5 entries" inline in the snapshot header. | Optional polish. |

## Net effect

- ~16 phantom mods → 0 every `git status`
- ~166 STATE.xml essay overwrites → append-only entries
- 361 dead lines purged from `bin/gad.cjs`
- 10 same-date collision-prone notes → all future notes carry agent slug
- One canonical "which gad to invoke" doc that lives alongside the code

Combined with sweeps B + C earlier today, this is the third pass at making the repo simple for agents to navigate without stepping on each other.

## Related notes

- `.planning/notes/2026-04-19-diff-noise-sweep.md` — sweep B + C (graph cache + tracked-derived files)
- `.planning/notes/2026-04-19-44-28-spine-second-cut.md` — sweep A (44-34 cancellation, installer + site packaging)
