# CLI vs Raw: Actual Outputs — v2

Side-by-side capture of every byte read in each workflow. Same information, different surface area.

---

## Total bytes

| Workflow | Bytes | Source count |
|----------|-------|--------------|
| **A — CLI** | 2,023 | 5 commands |
| **B — Raw** | 42,682 | 6 files |
| **Reduction** | **95.3%** | |

---

## Workflow A — CLI output (2,023 bytes total)

### 1. `gad context --json` (428 bytes)

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

**What this tells an agent:** which 4 files to read for context. Does not inline content — that's intentional. File refs are pointers, not payloads.

---

### 2. `gad state --json` (348 bytes)

```json
[
  {
    "project": "global",
    "phase": "05",
    "milestone": "cross-project-observability-01",
    "status": "active",
    "open tasks": "2",
    "last activity": "1 tasks done in phase 05",
    "next action": "Execute `05-01`: finish the cross-project observability baseline by adding privacy-aware Vercel Analytics to the portfol…"
  },
  {
    "project": "repo-planner",
    "phase": "7/7",
    "milestone": "gad-migration-01",
    "status": "active",
    "open tasks": "—",
    "last activity": "2026-04-04"
  }
]
```

**What this tells an agent:** current phase, milestone, status, open task count, next action (truncated). Enough to orient without reading STATE.xml (3,333 bytes).

---

### 3. `gad phases --json` (749 bytes)

```json
[
  { "project": "global", "id": "01", "status": "done",    "title": "Phase 01 (closed 2026-03-28): `.planning-archive` removed..." },
  { "project": "global", "id": "02", "status": "active",  "title": "Phase 02: define and execute the shared data/storage prov..." },
  { "project": "global", "id": "03", "status": "active",  "title": "Phase 03: extract `@portfolio/repub-builder` into its own..." },
  { "project": "global", "id": "04", "status": "done",    "title": "Phase 04 (closed 2026-03-31): move the next public catalo..." },
  { "project": "global", "id": "05", "status": "active",  "title": "Phase 05: land a cheap cross-project observability baseli..." },
  { "project": "repo-planner", "id": "1", "status": "done",    "title": "Phase 1: Portfolio integration baseline" },
  { "project": "repo-planner", "id": "2", "status": "done",    "title": "Phase 2: Package host contract" },
  { "project": "repo-planner", "id": "3", "status": "done",    "title": "Phase 3: Live cockpit" },
  { "project": "repo-planner", "id": "4", "status": "done",    "title": "Phase 4: Built-in planning-pack generation" },
  { "project": "repo-planner", "id": "5", "status": "done",    "title": "Phase 5: Workflow loop" },
  { "project": "repo-planner", "id": "6", "status": "done",    "title": "Phase 6: Structured cockpit views" },
  { "project": "repo-planner", "id": "7", "status": "planned", "title": "Phase 7: GAD migration" }
]
```

**What this tells an agent:** all phases across all projects, done/active/planned, with first ~60 chars of goal. Replaces reading ROADMAP.xml (2,869 bytes).

---

### 4. `gad tasks --json --status in-progress` (355 bytes)

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

**What this tells an agent:** exactly which tasks are blocking / in-flight. Replaces grepping TASK-REGISTRY.xml (13,700 bytes) for status="in-progress".

---

### 5. `gad session list --json` (143 bytes)

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

**What this tells an agent:** active session to resume with `gad context --session <id>`. Replaces reading session.md (1,590 bytes).

---

## Workflow B — Raw file reads (42,682 bytes total)

### 1. `AGENTS.md` (13,242 bytes) — full content

Contains: planning model table, mandatory read order (5 sections), the loop (7 steps), phase rules, machine-local paths spec, build commands, verification gates, **context compaction protocol**, GSD notes, artifacts table, conventions, and the entire public site copy style guide.

**What an agent actually needs from this to resume work:** the loop steps (~400 bytes), context compaction section (~500 bytes), and build commands (~150 bytes). The rest is reference that doesn't change session-to-session.

**Information extracted by CLI:** loop steps → implicit in gad workflow; compaction protocol → embedded in AGENTS.md (still needs to be read once); build commands → not surfaced by CLI.

---

### 2. `.planning/AGENTS.md` (7,948 bytes) — full content

Contains: what .planning/ is, file→role table, trigger phrases table, TASK-REGISTRY.xml pattern, ROADMAP.xml pattern, STATE.xml description, done gate rules, **context compaction protocol**.

**What an agent needs to resume:** trigger phrases (~200 bytes), done gate (~100 bytes). The rest is reference.

---

### 3. `.planning/STATE.xml` (3,333 bytes) — full content

```xml
<?xml version="1.0" encoding="UTF-8"?>
<state>
  <agent-registry />
  <current-phase>05</current-phase>
  <current-plan>cross-project-observability-01</current-plan>
  <status>active</status>
  <next-action>Execute `05-01`: finish the cross-project observability baseline by adding privacy-aware Vercel Analytics to the portfolio and Grime Time public layouts, land Grime Time request-id tracing plus safe summaries for the contact, instant-quote, schedule, and internal copilot routes, cover the helper and route headers with tests, and verify the planning snapshot after targeted lint/typecheck/build runs. Dependency note: `@vercel/analytics` is already present in `vendor/grime-time-site/package.json`, and `pnpm-lock.yaml` already contains the `apps/portfolio` importer entry from the earlier add attempt, but `apps/portfolio/package.json` still needs to be aligned cleanly.</next-action>
  <references>
    <reference>AGENTS.md (repo root)</reference>
    <reference>apps/portfolio/content/docs/global/requirements.mdx</reference>
    ... (22 more reference entries)
  </references>
  <agent-id-policy>...</agent-id-policy>
</state>
```

**Critical information:** current-phase (7 bytes), current-plan (35 bytes), next-action (496 bytes). The 22 references are 1,800+ bytes of paths an agent must read individually.

**CLI coverage:** phase ✅, milestone ✅, status ✅, next-action ✅ (truncated), references → replaced by `gad context` refs (4 targeted files vs 22 raw paths)

---

### 4. `.planning/ROADMAP.xml` (2,869 bytes) — full content

```xml
<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="01">
    <goal>Phase 01 (closed 2026-03-28): `.planning-archive` removed after migration into public docs; ...</goal>
    <status>done</status>
    <depends></depends>
  </phase>
  <phase id="02">
    <goal>Phase 02: define and execute the shared data/storage provider contract ...</goal>
    <status>active</status>
    <depends>01</depends>
  </phase>
  ... (3 more phases + doc-flow block)
</roadmap>
```

**CLI coverage:** all 5 phases with id, status, truncated title ✅. Full goal text dropped — adds ~400 bytes/phase. Agent reads full goal only if needed.

---

### 5. `.planning/TASK-REGISTRY.xml` (13,700 bytes) — sample

```xml
<task id="02-01" agent-id="" status="in-progress">
  <goal>Plan and land the shared data/storage provider abstraction ...</goal>
  <keywords>supabase,storage,sqlite,drizzle</keywords>
  <commands><command>pnpm run build</command>...</commands>
  <depends>01-01</depends>
</task>
... (17 more tasks, most status="done")
```

**CLI coverage:** `gad tasks --status in-progress` returns the 2 in-progress tasks ✅. The 16 done tasks (12,000+ bytes) are only needed for history, not for resuming work.

---

### 6. `.planning/session.md` (1,590 bytes)

Legacy handoff file — current phase, in-flight context, blockers, last actions. Replaced by `gad session` + `gad context`.

**CLI coverage:** session list returns id, phase, status, updated ✅. In-flight details moved into session JSON files at `.planning/sessions/`.

---

## Information loss analysis

| Information unit | In raw (B) | In CLI (A) | Loss? |
|-----------------|-----------|-----------|-------|
| Current phase | STATE.xml | gad state | ✅ none |
| Milestone / plan | STATE.xml | gad state | ✅ none |
| Next action (full) | STATE.xml 496 bytes | gad state 120 bytes | ⚠️ truncated |
| Phase list + status | ROADMAP.xml 2,869 bytes | gad phases 749 bytes | ✅ none (titles truncated, full goal on demand) |
| In-progress tasks | TASK-REGISTRY.xml 13,700 bytes | gad tasks 355 bytes | ✅ none for resume use case |
| Done task history | TASK-REGISTRY.xml | not surfaced | ℹ️ by design — use gad tasks --status done |
| Agent read order / loop | AGENTS.md 13,242 bytes | not inlined | ℹ️ by design — agent reads AGENTS.md once |
| Site copy style guide | AGENTS.md ~4,000 bytes | not surfaced | ℹ️ irrelevant for context resume |
| 22 reference paths | STATE.xml | gad context (4 targeted) | ✅ better — 18 stale paths removed |
| Session continuity | session.md 1,590 bytes | gad session 143 bytes | ✅ none |

## Key finding

The raw workflow delivers 42,682 bytes — but **~35,000 bytes are not needed to resume work**. They're style guides, done-task history, stale reference paths, and reference docs that change rarely. The CLI surfaces the ~2,000 bytes that actually change session-to-session.

The one real loss: `next-action` truncated at 120 chars. The full text (496 bytes) carries dependency notes an agent needs. Fix: either increase truncation limit or expose `gad state --full` flag.
