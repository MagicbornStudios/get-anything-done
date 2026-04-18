# State Writes Inventory (Task 63-01)

## Summary

| Pattern | Count | Health | Category |
|---------|-------|--------|----------|
| (a) AGGREGATE — CLI-mediated | 5 | CONTESTED—unsafe | `.planning/{STATE.xml, TASK-REGISTRY.xml, DECISIONS.xml, ROADMAP.xml, HUMAN-TODOS.xml}` |
| (b) APPEND-ONLY JSONL | 4 | SAFE | `.planning/.gad-log/*.jsonl, .trace-events.jsonl, .gad-agent-lanes.json (rotation), sessions/*.json` |
| (c) SINGLE-OWNER (agent subdir) | 7 | UNSAFE | `.omx/state/*.json` (7 files, no exclusivity enforcement) |
| (d) INTENT (fs.rename + per-file dir) | 0 | N/A | (not yet implemented in current architecture) |

**Currently broken (multi-writer conflicts):**
- `.omx/state/*.json` — no per-agent isolation; last-write-wins risk across claude-code, codex, cursor, hooks
- `.planning/STATE.xml, TASK-REGISTRY.xml` — CLI-mediated reads but direct fs writes by task-registry-writer.cjs and decisions-writer.cjs bypass locking
- `.planning/.trace-seq` — monotonic counter appended by gad-trace-hook.cjs during concurrent session activity

---

## Inventory Table

| Path | Pattern | Current Writers | Safe Today? | Consolidation Action |
|------|---------|-----------------|-------------|----------------------|
| `.planning/STATE.xml` | (a) AGGREGATE | CLI (gad), task-registry-writer.cjs (direct write) | NO | Route all writes through CLI; remove direct fs.writeFileSync in task-registry-writer.cjs |
| `.planning/TASK-REGISTRY.xml` | (a) AGGREGATE | CLI (gad), task-registry-writer.cjs (direct write) | NO | Same as STATE.xml: CLI-mediated only |
| `.planning/DECISIONS.xml` | (a) AGGREGATE | CLI (gad), decisions-writer.cjs (direct write) | NO | Consolidate via CLI wrapper |
| `.planning/ROADMAP.xml` | (a) AGGREGATE | CLI (gad), roadmap-writer.cjs (direct write) | NO | Consolidate via CLI wrapper |
| `.planning/HUMAN-TODOS.xml` | (a) AGGREGATE | CLI (gad), todos-writer.cjs (direct write) | NO | Consolidate via CLI wrapper |
| `.planning/.gad-log/YYYY-MM-DD.jsonl` | (b) APPEND-ONLY | CLI (gad), claude-code (tool-trace.js hook) | YES | Safe by JSONL append semantics; document sync-free in decision |
| `.planning/.trace-events.jsonl` | (b) APPEND-ONLY | gad-trace-hook.cjs (Claude Code PostToolUse) | SAFE-WITH-CAVEAT | fs.appendFileSync is atomic on POSIX; Windows fs.appendFileSync may batch; add guard for concurrent eval runs |
| `.planning/.trace-seq` | (b) APPEND-ONLY | gad-trace-hook.cjs (monotonic increment) | NO | File contains integer counter; multi-writer append loses ordering; needs fs.rename-based CAS or Mutex |
| `.planning/.gad-agent-lanes.json` | (c) SINGLE-OWNER | CLI (gad) only (read-only snapshot) | YES | Confirmed read-only; safe |
| `.planning/graph.json` | (c) SINGLE-OWNER | gad (graph-extractor.cjs), eval-data-access.cjs | YES | Regenerated per-run; no concurrent writers expected |
| `.planning/config.json` | (c) SINGLE-OWNER | gad-config.cjs (CLI tool) | YES | CLI-owned; safe |
| `.planning/sessions/s-*.json` | (c) SINGLE-OWNER | gad (snapshot, per-session) | YES | Filename includes session id; isolation by pathname |
| `.planning/.gad-log/YYYY-MM-DD.jsonl` (append by hook) | (b) APPEND-ONLY | claude-code hook (tool-trace.js) + CLI | YES | JSONL append-safe; separate writers by daily rotation |
| `.omx/state/hud-state.json` | (c) SINGLE-OWNER | Unknown (claude-code HUD, hooks?) | NO | Not found in vendor/gad source; presumed claude-code-internal; undocumented writers |
| `.omx/state/notify-hook-state.json` | (c) SINGLE-OWNER | Unknown (notification system?) | NO | Presumed claude-code-internal; no gad writer found |
| `.omx/state/skill-active-state.json` | (c) SINGLE-OWNER | Unknown | NO | Presumed claude-code-internal |
| `.omx/state/team-state.json` | (c) SINGLE-OWNER | Unknown | NO | Presumed claude-code-internal |
| `.omx/state/tmux-hook-state.json` | (c) SINGLE-OWNER | Unknown | NO | Presumed claude-code-internal |
| `.omx/state/current-task-baseline.json` | (c) SINGLE-OWNER | Unknown | NO | Presumed claude-code-internal |
| `.omx/state/team-leader-nudge.json` | (c) SINGLE-OWNER | Unknown | NO | Presumed claude-code-internal |
| `.omx/logs/turns-YYYY-MM-DD.jsonl` | (b) APPEND-ONLY | claude-code (turn logger) | SAFE-MAYBE | fs.appendFileSync used; same Windows caveats as .trace-events |
| `.omx/logs/tmux-hook-YYYY-MM-DD.jsonl` | (b) APPEND-ONLY | claude-code (tmux hook) | SAFE-MAYBE | fs.appendFileSync used; platform caveat |
| `.omx/metrics.json` | (c) SINGLE-OWNER | claude-code (metrics collector) | MAYBE | Not in gad source; claude-code-internal |
| `~/.cache/gad/gad-update-check.json` | (c) SINGLE-OWNER | CLI (gad update check) | YES | User-level singleton; safe |
| `.claude/settings.json` | (c) SINGLE-OWNER | User + Claude Code UI | CONTESTED | Out of scope (harness-owned); not state consolidation |
| `.claude/settings.local.json` | (c) SINGLE-OWNER | User + hooks | CONTESTED | Out of scope |
| `.claude/hooks/state` | (c) SINGLE-OWNER | Unknown | UNKNOWN | Directory or file? Not found in repo |

---

## Top 5 Consolidation Actions

### 1. **Unify XML write paths via CLI wrappers** [M]
**Problem:** task-registry-writer.cjs, decisions-writer.cjs, roadmap-writer.cjs, todos-writer.cjs each call fs.writeFileSync/rename directly on STATE.xml, DECISIONS.xml, ROADMAP.xml, HUMAN-TODOS.xml. This bypasses CLI transaction semantics and creates race windows when concurrent gad commands run.

**Fix:** 
- Refactor each *-writer.cjs into a pure function: buildXml(existing, newEntry) → newXmlString
- Add CLI commands: `gad task add`, `gad decision add`, `gad roadmap add`, `gad todo add`
- CLI wraps file I/O with locking (flock or CAS via rename)
- Remove direct fs.writeFileSync calls from bin/gad.cjs handlers; route through writers

**Estimate:** M (1–2 days: 5 files × 1–2 CLI wrappers, unit tests per writer)

**Owner:** claude-code (planning/serialization lane)

---

### 2. **Fix .trace-seq monotonic counter contention** [S]
**Problem:** gad-trace-hook.cjs appends to `.planning/.trace-seq` (single integer line) on every PostToolUse. Concurrent eval runs and sessions cause interleaved writes; counter loses ordering. Max observed value becomes unreliable.

**Fix:**
- Replace file-based counter with atomic read-modify-write via temp file + rename (Windows-safe per secrets-lifecycle.cjs pattern)
- Or: move seq to a per-run file: `.planning/.trace-events-SESSIONID.seq`
- Document fs.appendFileSync safety on Windows in decision (decision gad-XXX-seq-safety)

**Estimate:** S (4 hours: 1 file, add rename CAS + unit test)

**Owner:** claude-code (trace infrastructure lane)

---

### 3. **Document and gate .omx/* writes per-agent** [L]
**Problem:** `.omx/state/*.json` and `.omx/logs/*.jsonl` have unknown writers. claude-code harness, hooks, and possibly agents may all write without coordination. No exclusivity enforcement.

**Fix:**
- Audit .omx/* writes by instrumenting claude-code sources (grep HUD, notify, skill-active, team-state, tmux-hook)
- Create per-agent isolation: .omx/{agent-id}/state/, .omx/{agent-id}/logs/
- Document JSONL append-safety for .omx/logs/* (caveat: Windows fs.appendFileSync timing)
- Add memory note: .omx/* is out of gad purview; refer to Claude Code harness docs

**Estimate:** L (3–5 days: audit cross-codebase, design new layout, coordinate with harness team)

**Owner:** claude-code + vercel-ai-sdk team (harness responsibility)

---

### 4. **Separate .gad-log writes by runtime (CLI vs hook)** [S]
**Problem:** Both gad CLI and claude-code tool-trace.js hook append to `.planning/.gad-log/YYYY-MM-DD.jsonl`. Writes are JSONL-safe but interleaved entries obscure causality (CLI runs before/after hook invocations not timestamped relative to each other).

**Fix:**
- Keep shared JSONL (append-safe)
- Add `runtime` field to every log entry (e.g., `"runtime": "cli"` vs `"runtime": "claude-code"`)
- Optionally rotate: `.planning/.gad-log/cli/` and `.planning/.gad-log/hooks/` with separate YYYY-MM-DD.jsonl
- Clarify in decision: JSONL append is safe but order not guaranteed; use `ts` (timestamp) as source-of-truth

**Estimate:** S (2–3 hours: 2 files, add field, tests)

**Owner:** claude-code (logging lane)

---

### 5. **Make .planning/*.xml writes atomic with validation** [M]
**Problem:** Current writers (task-registry-writer.cjs etc.) write directly to disk. No pre-write schema validation; no post-write verification. Corruption risk under interruption or disk full.

**Fix:**
- All *-writer.cjs functions: validate output XML schema before rename
- Atomic pattern: write to `.pending.xml`, validate, rename to target (all in one transaction)
- Add recovery: gad verify rebuilds .pending files and reports diffs
- Decision: all .planning/*.xml are append-only wrt content (never delete, never update existing entries)

**Estimate:** M (1–2 days: update 5 writers, add validation, recovery logic, tests)

**Owner:** claude-code (planning/serialization lane)

---

## Open Questions

1. **What writes .omx/state/{hud-state, notify-hook-state, skill-active-state, team-state, tmux-hook-state}.json?**
   - Not found in vendor/gad source. Presumed claude-code harness internals.
   - Can we move to isolated per-agent dirs (.omx/{agent-id}/state/)?
   - Should they be in the consolidation audit at all, or out-of-scope for gad?

2. **Is .planning/.gad-log/YYYY-MM-DD.jsonl write-ordering safe on Windows?**
   - fs.appendFileSync on Windows may buffer writes from multiple processes.
   - Tested scenario: concurrent `gad` CLI + claude-code hook appends. Are entries ever interleaved or corrupted?
   - Recommend: run concurrency-safety.test.cjs with multiple agents + verify no entry loss.

3. **Should .trace-seq be a per-run counter or per-session?**
   - Current: single global file, all evals + all sessions write to it.
   - Proposed: per-eval or per-session, reset at eval start?
   - Decision needed on seq semantics: is it expected to be globally monotonic, or restart per batch?

4. **.claude/hooks/state — is this a file or directory?**
   - Not found on disk in current state. Referenced in task goal.
   - Is this a planned location or a historical artifact?
   - Clarify scope: what state should live in .claude/ vs .planning/?

5. **Is pattern (d) "INTENT (fs.rename + per-file dir)" needed in current architecture?**
   - Task goal lists it; zero instances found. 
   - Cross-agent message-passing currently uses subagent dispatch + stdout.
   - Should we implement handoff/ layout per decision gad-XXX-intent-dir, or defer until needed?

---

## Reference Decision Pointers

- **gad-50, gad-53, gad-58:** Trace hook infrastructure
- **gad-59:** Hook wiring and propagation
- **gad-60:** Hook error handling
- **gad-195:** Do not re-run full snapshot (auto-compact discipline)
- **gad-D-104:** Task attribution mandatory in registry
- **gad-D-18:** The loop (startup → snapshot → task → implement → commit)

---

**Generated:** 2026-04-18 | Task: 63-01 state+log consolidation audit
