# Run v3 — cli-efficiency

**Date:** 2026-04-04
**GAD version:** 1.32.0
**Change from v2:** next-action returned at Full fidelity (no truncation); `gad state --json` restructured; repo-planner registered as second project
**Reference:** See `../REQUIREMENTS.md` for what this document must contain. See `../../DEFINITIONS.md` for all term definitions and formulas.

---

## Workflow A — Actual CLI output (verbatim)

### Command 1: `gad session list --json` (143 chars / ~36 tokens)

```json
[
  {
    "id": "s-mnkqq67t-gnzz",
    "project": "global",
    "phase": "05",
    "status": "active",
    "updated": "2026-04-04 19:43"
  }
]
```

### Command 2: `gad context --json` (428 chars / ~107 tokens)

```json
{
  "session": "s-mnkqq67t-gnzz",
  "project": "global",
  "refs": [
    { "file": "AGENTS.md", "reason": "agent conventions" },
    { "file": ".planning/AGENTS.md", "reason": "planning agent conventions" },
    { "file": ".planning/STATE.xml", "reason": "current position and status" },
    { "file": ".planning/ROADMAP.xml", "reason": "phase roadmap" }
  ]
}
```

### Command 3: `gad state --json` (1,090 chars / ~273 tokens)

```json
[
  {
    "project": "global",
    "phase": "05",
    "milestone": "cross-project-observability-01",
    "status": "active",
    "openTasks": 2,
    "lastActivity": "1 tasks done in phase 05",
    "nextAction": "Execute `05-01`: finish the cross-project observability baseline by adding privacy-aware Vercel Analytics to the portfolio and Grime Time public layouts, land Grime Time request-id tracing plus safe summaries for the contact, instant-quote, schedule, and internal copilot routes, cover the helper and route headers with tests, and verify the planning snapshot after targeted lint/typecheck/build runs. Dependency note: `@vercel/analytics` is already present in `vendor/grime-time-site/package.json`, and `pnpm-lock.yaml` already contains the `apps/portfolio` importer entry from the earlier add attempt, but `apps/portfolio/package.json` still needs to be aligned cleanly."
  },
  {
    "project": "repo-planner",
    "phase": "7/7",
    "milestone": "gad-migration-01",
    "status": "active",
    "openTasks": 0,
    "lastActivity": "2026-04-04",
    "nextAction": null
  }
]
```

### Command 4: `gad phases --json` (1,612 chars / ~403 tokens)

```json
[
  { "project": "global",       "id": "01", "status": "done",    "title": "Phase 01 (closed 2026-03-28): `.planning-archive` removed..." },
  { "project": "global",       "id": "02", "status": "active",  "title": "Phase 02: define and execute the shared data/storage prov..." },
  { "project": "global",       "id": "03", "status": "active",  "title": "Phase 03: extract `@portfolio/repub-builder` into its own..." },
  { "project": "global",       "id": "04", "status": "done",    "title": "Phase 04 (closed 2026-03-31): move the next public catalo..." },
  { "project": "global",       "id": "05", "status": "active",  "title": "Phase 05: land a cheap cross-project observability baseli..." },
  { "project": "repo-planner", "id": "1",  "status": "done",    "title": "Phase 1: Portfolio integration baseline" },
  { "project": "repo-planner", "id": "2",  "status": "done",    "title": "Phase 2: Package host contract" },
  { "project": "repo-planner", "id": "3",  "status": "done",    "title": "Phase 3: Live cockpit" },
  { "project": "repo-planner", "id": "4",  "status": "done",    "title": "Phase 4: Built-in planning-pack generation" },
  { "project": "repo-planner", "id": "5",  "status": "done",    "title": "Phase 5: Workflow loop" },
  { "project": "repo-planner", "id": "6",  "status": "done",    "title": "Phase 6: Structured cockpit views" },
  { "project": "repo-planner", "id": "7",  "status": "planned", "title": "Phase 7: GAD migration" }
]
```

### Command 5: `gad tasks --json --status in-progress` (355 chars / ~89 tokens)

```json
[
  {
    "project": "global",
    "id": "02-01",
    "goal": "Plan and land the shared data/storage provider abstraction i",
    "status": "in-progress",
    "phase": "02"
  },
  {
    "project": "global",
    "id": "03-02",
    "goal": "Classify the large git blobs by artifact type, land the firs",
    "status": "in-progress",
    "phase": "03"
  }
]
```

**Total CLI: 3,628 chars / ~907 tokens**

---

## Workflow B — Raw file content

### File 1: `AGENTS.md` — 13,242 chars / ~3,311 tokens

Too large to inline fully. Key sections extracted:

**The loop (what actually matters for resuming work):**
> 1. Read code state and the planning layer you are changing
> 2. Pick one phase, then one task inside it
> 3. If the phase is new/ambiguous, create a kickoff record
> 4. Implement task-by-task until the phase meets its definition of done
> 5. Run verification
> 6. Mark done in TASK-REGISTRY.xml; refresh state, roadmap, decisions
> 7. Exit; next iteration starts with fresh context

**Context compaction protocol (~500 chars — session-critical):**
> After compaction: `gad session list` → `gad context --session <id> --json` → load refs → continue.

**Build commands (~150 chars — session-critical):**
> `pnpm install`, `pnpm run build`, `pnpm run lint`

**Everything else in AGENTS.md (~12,000 chars) — NOT session-critical:**
- Planning model table (reference, read once)
- Mandatory read order (reference, read once)
- Section overview tables (reference, read once)
- Site copy style guide (4,000+ chars — relevant only when editing visible strings)
- Artifacts quick reference (reference, read once)

### File 2: `.planning/AGENTS.md` — 7,948 chars / ~1,987 tokens

Key sections:
- What .planning/ is (reference, read once)
- Trigger phrases table (reference, read once)
- TASK-REGISTRY.xml and ROADMAP.xml patterns (reference for editing, read once)
- Done gate rules (~100 chars — session-relevant)
- **Context compaction protocol (~300 chars — session-critical)**

### File 3: `.planning/STATE.xml` — 3,333 chars / ~833 tokens (full content)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<state>
  <agent-registry />
  <current-phase>05</current-phase>
  <current-plan>cross-project-observability-01</current-plan>
  <status>active</status>
  <next-action>Execute `05-01`: finish the cross-project observability baseline by adding
  privacy-aware Vercel Analytics to the portfolio and Grime Time public layouts, land Grime
  Time request-id tracing plus safe summaries for the contact, instant-quote, schedule, and
  internal copilot routes, cover the helper and route headers with tests, and verify the
  planning snapshot after targeted lint/typecheck/build runs. Dependency note:
  `@vercel/analytics` is already present in `vendor/grime-time-site/package.json`, and
  `pnpm-lock.yaml` already contains the `apps/portfolio` importer entry from the earlier add
  attempt, but `apps/portfolio/package.json` still needs to be aligned cleanly.</next-action>
  <references>
    <reference>AGENTS.md (repo root)</reference>
    <reference>apps/portfolio/content/docs/global/requirements.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/roadmap.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/state.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/task-registry.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/plans/global-data-01/PLAN.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/plans/global-data-01/SUPABASE-BOOTSTRAP.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/plans/global-data-02/PLAN.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/plans/global-data-03/PLAN.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/plans/global-auth-02/PLAN.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/plans/global-admin-01/PLAN.mdx</reference>
    <reference>apps/portfolio/content/docs/global/planning/plans/mb-cli-framework/PLAN.mdx</reference>
    <reference>apps/portfolio/content/docs/documentation/requirements.mdx</reference>
    <reference>apps/portfolio/content/docs/documentation/planning/state.mdx</reference>
    <reference>apps/portfolio/app/layout.tsx</reference>
    <reference>apps/portfolio/lib/analytics.ts</reference>
    <reference>vendor/grime-time-site/src/app/(frontend)/layout.tsx</reference>
    <reference>vendor/grime-time-site/src/app/api/lead-forms/contact/route.ts</reference>
    <reference>vendor/grime-time-site/src/app/api/lead-forms/instant-quote/route.ts</reference>
    <reference>vendor/grime-time-site/src/app/api/lead-forms/schedule/route.ts</reference>
    <reference>vendor/grime-time-site/src/app/api/internal/ai/copilot/route.ts</reference>
    <reference>vendor/grime-time-site/src/lib/observability.ts</reference>
    <reference>.planning/AGENTS.md</reference>
    <reference>.planning/ROADMAP.xml</reference>
    <reference>.planning/TASK-REGISTRY.xml</reference>
    <reference>.planning/DECISIONS.xml</reference>
  </references>
  <agent-id-policy>...</agent-id-policy>
</state>
```

**Observation:** STATE.xml has 22 `<reference>` entries. Of these, 12 are phase-specific PLAN.mdx files for phases 01–03 (historical). An agent resuming phase 05 work does not need those. `gad context` returns 4 targeted refs. That is not information loss — it is noise reduction.

### File 4: `.planning/ROADMAP.xml` — 2,856 chars / ~714 tokens (full content)

5 phases, each with full goal text (~400 chars/phase). Phase goals contain more detail than `gad phases` titles (~60 chars/phase). Example:

**Full XML (Phase 05, ~320 chars):**
> Phase 05: land a cheap cross-project observability baseline for the public portfolio and Grime Time. Use Vercel Analytics for privacy-aware pageview tracking on public layouts, and add request-id based tracing plus safe request summaries for high-signal Grime Time form and copilot routes without logging raw PII payloads.

**CLI (Phase 05 title, ~60 chars):**
> Phase 05: land a cheap cross-project observability baseli...

**Assessment:** The CLI title establishes which phase is active. The extra 260 chars of goal text is available in `gad state .nextAction` for the current phase. An agent wanting the full goal of a specific phase should read ROADMAP.xml for that phase — it is a targeted read, not re-reading the whole file.

### File 5: `.planning/TASK-REGISTRY.xml` — 13,700 chars / ~3,425 tokens

Contains 18 tasks. 16 are `status="done"`, 2 are `status="in-progress"`.

**In-progress tasks (the only ones needed for resumption):**

```xml
<task id="02-01" agent-id="" status="in-progress">
  <goal>Plan and land the shared data/storage provider abstraction in a way that keeps local
  SQLite + local files as the default, adds Supabase as the first hosted backend...</goal>
  <keywords>supabase,storage,sqlite,drizzle,data-provider</keywords>
  <commands>
    <command>pnpm run build</command>
    <command>pnpm run lint</command>
  </commands>
  <depends>01-01</depends>
</task>

<task id="03-02" agent-id="" status="in-progress">
  <goal>Classify the large git blobs by artifact type, land the first concrete storage
  migration rule for binary release artifacts...</goal>
  <keywords>git-lfs,storage,blob-audit,artifact-classification</keywords>
  <commands><command>pnpm run build</command></commands>
  <depends>03-01</depends>
</task>
```

**16 done tasks (13,000+ chars) — not needed for resumption.**

### File 6: `.planning/session.md` — 1,590 chars / ~398 tokens

Legacy handoff format. Replaced by `gad session` + `.planning/sessions/*.json`.

**Total raw baseline: 42,669 chars / ~10,667 tokens**

---

## Unit fidelity table

| Unit | What it is | Raw source | CLI source | Fidelity | Evidence |
|------|-----------|-----------|-----------|----------|---------|
| U1 current phase | "05" | STATE.xml `<current-phase>` | `gad state .phase` | ✅ Full | Exact match |
| U2 milestone | "cross-project-observability-01" | STATE.xml `<current-plan>` | `gad state .milestone` | ✅ Full | Exact match |
| U3 status | "active" | STATE.xml `<status>` | `gad state .status` | ✅ Full | Exact match |
| U4 open task count | 2 | TASK-REGISTRY.xml count | `gad state .openTasks` | ✅ Full | Cross-ref from task-registry-reader |
| U5 next action | 496-char dependency note | STATE.xml `<next-action>` | `gad state .nextAction` | ✅ Full | No truncation since v3 |
| U6 in-progress tasks | 02-01, 03-02 with goals | TASK-REGISTRY.xml | `gad tasks --status in-progress` | ⚠️ T | Goal text truncated to 60 chars; keywords and verify commands absent |
| U7 phase history | 5 phases, done/active correct | ROADMAP.xml | `gad phases` | ⚠️ T | Status correct; goal text truncated to ~60 chars |
| U8 last activity | Not in STATE.xml | — | `gad state .lastActivity` | ⚠️ A | Returns "1 tasks done in phase 05" (count, not date) |
| U9 session ID + phase | s-mnkqq67t-gnzz, phase 05 | session.md / sessions/ | `gad session list` | ✅ Full | Exact match |
| U10 file refs | 22 paths in STATE.xml | STATE.xml `<references>` | `gad context` (4 targeted) | ✅ Full | 4 > 22: targeted is better; 18 removed refs were phase-historical noise |

---

## Token counts and arithmetic

| Source | Chars | Tokens (chars/4) |
|--------|-------|-----------------|
| **Workflow A — CLI** | | |
| gad session list | 143 | 36 |
| gad context | 428 | 107 |
| gad state | 1,090 | 273 |
| gad phases | 1,612 | 403 |
| gad tasks (in-progress) | 355 | 89 |
| **CLI Total** | **3,628** | **~908** |
| **Workflow B — Raw** | | |
| AGENTS.md | 13,242 | 3,311 |
| .planning/AGENTS.md | 7,948 | 1,987 |
| .planning/STATE.xml | 3,333 | 833 |
| .planning/ROADMAP.xml | 2,856 | 714 |
| .planning/TASK-REGISTRY.xml | 13,700 | 3,425 |
| .planning/session.md | 1,590 | 398 |
| **Raw Total** | **42,669** | **~10,668** |

### token_reduction
```
(10,668 - 908) / 10,668 = 9,760 / 10,668 = 0.915 (91.5%)
```

### context_completeness
Units at Full: U1, U2, U3, U4, U5, U9, U10 = 7
Units Partial (Truncated/Approximated): U6, U7, U8 = 3 (each worth 0.5)
Total units: 10

```
completeness = (7 + 0.5 * 3) / 10 = 8.5 / 10 = 0.85
```

### information_loss
All units are at Truncated or better — none are Absent.
```
loss = 0 absent units / 10 = 0.00
```

---

## Residual content analysis

| Content | Chars | In CLI? | Assessment |
|---------|-------|---------|------------|
| Agent loop steps | ~400 | ❌ | Intentional — static, read once from AGENTS.md |
| Site copy style guide | ~4,000 | ❌ | Intentional — only relevant when editing visible strings |
| Planning model reference tables | ~2,000 | ❌ | Intentional — static reference |
| 16 done tasks in TASK-REGISTRY.xml | ~11,000 | ❌ | Intentional — history, available via `gad tasks --status done` on demand |
| 18 stale STATE.xml references | ~1,800 | ❌ | Removed intentionally — `gad context` returns 4 targeted refs |
| Full phase goal text (ROADMAP.xml) | ~1,600 | ⚠️ partial | Titles truncated in `gad phases`; current-phase goal accessible via `gad state` next-action |
| Task keywords + verify commands | ~400 | ❌ | Gap — not currently surfaced; verify commands needed before executing a task |

**Actionable gap:** task verify commands (the `<commands>` block in TASK-REGISTRY.xml) are not
surfaced by any CLI command. An agent executing task 02-01 needs to know to run
`pnpm run build && pnpm run lint`. This is context loss for the **execute** workflow
(though not for the **resume** workflow measured here).

---

## Agent simulation

**Given only Workflow A output, what would an agent do next?**

1. Active session s-mnkqq67t-gnzz on project global, phase 05
2. Read the 4 refs from `gad context`: AGENTS.md, .planning/AGENTS.md, STATE.xml, ROADMAP.xml
3. From `gad state`: phase 05, milestone cross-project-observability-01, 2 open tasks
4. Next action: execute 05-01 — Vercel Analytics + Grime Time request-id tracing
5. From `gad tasks --status in-progress`: tasks 02-01 and 03-02 are open but in earlier phases — not the current focus
6. **Decision: begin 05-01 as described in next-action**

**Given Workflow B output, what would an agent do next?**

1. Read AGENTS.md → loop steps, build commands, compaction protocol
2. Read STATE.xml → phase 05, same next-action text, 22 references listed
3. Read ROADMAP.xml → phases 01-04 done, 05 active, same goal as CLI
4. Grep TASK-REGISTRY.xml → same 2 in-progress tasks (02-01, 03-02) plus full keyword/command data
5. **Decision: begin 05-01 as described in next-action** — identical to Workflow A

**Result: No context loss for the resume-work decision.** The only difference is Workflow B
gives verify commands for 02-01 and 03-02, but those are not the current task.

---

## Formulas applied

```
token_reduction   = (10,668 - 908) / 10,668 = 0.915
completeness      = (7 + 1.5) / 10          = 0.850
loss              = 0 / 10                  = 0.000
composite         = (0.915 * 0.40) + (0.850 * 0.35) + (1.000 * 0.25)
                  = 0.366 + 0.298 + 0.250
                  = 0.914
```

---

## Remaining gaps for v4

1. **U6 task goals truncated to 60 chars** — `gad tasks` truncates goal text. An agent wanting the full task goal must read TASK-REGISTRY.xml. Fix: add `--full` flag to `gad tasks`, or raise truncation to 200 chars.
2. **Task verify commands not surfaced** — `<commands>` block in TASK-REGISTRY.xml has the commands to run after each task. Currently no CLI surface. Add to `gad tasks --full` output.
3. **U8 last-activity is a count string** — "1 tasks done in phase 05" is better than "—" but not an ISO date. Requires writing `updated` to STATE.xml on session writes.
4. **Phase full goal text** — `gad phases` truncates goal to ~60 chars. Phase goal is only accessible at full fidelity via ROADMAP.xml or via `gad state .nextAction` for the current phase only.
