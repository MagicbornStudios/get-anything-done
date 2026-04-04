# Claude Code Context Budget — Sonnet 4.6

**Model:** claude-sonnet-4-6  
**Context window:** 200,000 tokens  
**Token estimate method:** bytes ÷ 4 (standard English/code approximation; exact tokenization varies)  
**Measured:** 2026-04-04, `custom_portfolio` project  
**Repo:** `MagicbornStudios/get-anything-done`

---

## 1. Complete Baseline Inventory

Everything below is injected into the model **before the first user message** in a fresh session.

### 1.1 Fixed system prompt layers

| Layer | Source | Est. bytes | Est. tokens | % of 200K |
|-------|--------|-----------|-------------|-----------|
| Claude Code identity + behavioral rules | Anthropic (hardcoded) | ~12,000 | ~3,000 | 1.5% |
| Tool use formatting rules | Anthropic (hardcoded) | ~4,000 | ~1,000 | 0.5% |
| Git/commit/PR safety protocols | Anthropic (hardcoded) | ~6,000 | ~1,500 | 0.75% |
| Tone, output efficiency, environment block | Anthropic (hardcoded) | ~4,000 | ~1,000 | 0.5% |
| Session-specific guidance block | Anthropic (hardcoded) | ~2,000 | ~500 | 0.25% |
| **System prompt subtotal** | | **~28,000** | **~7,000** | **3.5%** |

### 1.2 Main tool schemas (always loaded)

9 tools with full JSON schemas present in the system prompt from session start.

| Tool | Path / Source | Est. bytes | Est. tokens | Notes |
|------|--------------|-----------|-------------|-------|
| `Agent` | Anthropic built-in | ~3,600 | ~900 | Largest: long description + subagent_type enum with 30+ values |
| `Bash` | Anthropic built-in | ~2,800 | ~700 | Long description with examples, run_in_background param |
| `Grep` | Anthropic built-in | ~2,400 | ~600 | Many params: output_mode enum, context lines, head_limit |
| `Edit` | Anthropic built-in | ~1,600 | ~400 | replace_all param + usage notes |
| `Read` | Anthropic built-in | ~1,400 | ~350 | PDF/notebook/image support description |
| `Write` | Anthropic built-in | ~1,200 | ~300 | |
| `Skill` | Anthropic built-in | ~1,200 | ~300 | Trigger rules + examples |
| `Glob` | Anthropic built-in | ~1,000 | ~250 | |
| `ToolSearch` | Anthropic built-in | ~800 | ~200 | |
| **Main tools subtotal** | | **~16,000** | **~4,000** | **2.0%** |

### 1.3 Skill list (system-reminder, always present)

80+ skills listed by name + one-line description in `<system-reminder>` on every turn.

| Category | Count | Est. tokens |
|----------|-------|-------------|
| `gsd:*` skills (GSD workflow skills) | ~55 | ~1,200 |
| `rp-*` skills (RepoPlanner — now deprecated) | ~11 | ~200 |
| Framework skills (frontend-design, shadcn, etc.) | ~8 | ~200 |
| Utility skills (commit, review-pr, claude-api, etc.) | ~8 | ~200 |
| **Skill list subtotal** | **~82** | **~1,800** | 0.9% |

### 1.4 Deferred tool schemas (loaded on demand via ToolSearch)

23 tools listed by name only at session start. Schemas fetched mid-session add tokens permanently once loaded.

| Tool | Category | Est. tokens when loaded | Typical session load? |
|------|----------|------------------------|-----------------------|
| `TaskCreate` | Task management | ~250 | Yes |
| `TaskGet` | Task management | ~200 | Yes |
| `TaskList` | Task management | ~200 | Yes |
| `TaskOutput` | Task management | ~200 | Yes |
| `TaskStop` | Task management | ~200 | Yes |
| `TaskUpdate` | Task management | ~200 | Yes |
| `CronCreate` | Cron scheduling | ~350 | Sometimes |
| `CronDelete` | Cron scheduling | ~150 | Sometimes |
| `CronList` | Cron scheduling | ~150 | Sometimes |
| `EnterPlanMode` | Planning mode | ~150 | Rarely |
| `ExitPlanMode` | Planning mode | ~150 | Rarely |
| `EnterWorktree` | Worktree | ~150 | Rarely |
| `ExitWorktree` | Worktree | ~150 | Rarely |
| `NotebookEdit` | Jupyter | ~200 | Rarely |
| `RemoteTrigger` | Remote | ~150 | Rarely |
| `WebFetch` | Web | ~250 | Sometimes |
| `WebSearch` | Web | ~200 | Sometimes |
| `AskUserQuestion` | Interaction | ~200 | Sometimes |
| `mcp__ide__executeCode` | MCP/IDE | ~200 | Rarely |
| `mcp__ide__getDiagnostics` | MCP/IDE | ~200 | Rarely |
| `mcp__claude_ai_Gmail__authenticate` | MCP/SaaS | ~150 | Rarely |
| `mcp__claude_ai_Google_Calendar__authenticate` | MCP/SaaS | ~150 | Rarely |
| `mcp__claude_ai_Notion__authenticate` | MCP/SaaS | ~150 | Rarely |
| **All deferred, if fully loaded** | | **~4,400** | |
| **Typical session (6-8 loaded)** | | **~1,400** | **0.7%** |

### 1.5 conventionsPaths files (auto-loaded from planning-config.toml)

Defined in `.planning/planning-config.toml`:

```toml
conventionsPaths = [
  "AGENTS.md",
  ".planning/AGENTS.md",
  "apps/portfolio/content/docs/documentation/requirements.mdx",
  "apps/portfolio/content/docs/documentation/planning/state.mdx",
  "apps/portfolio/content/docs/documentation/roadmap.mdx",
]
```

Every file in this list is injected in full at session start, every session.

| File | Full path | Bytes | Lines | Est. tokens | % of 200K |
|------|-----------|-------|-------|-------------|-----------|
| `AGENTS.md` | `AGENTS.md` (repo root) | 12,389 | 146 | 3,097 | 1.5% |
| `state.mdx` | `apps/portfolio/content/docs/documentation/planning/state.mdx` | 11,643 | 84 | 2,910 | 1.5% |
| `requirements.mdx` | `apps/portfolio/content/docs/documentation/requirements.mdx` | 10,119 | 84 | 2,529 | 1.3% |
| `.planning/AGENTS.md` | `.planning/AGENTS.md` | 7,451 | 99 | 1,862 | 0.9% |
| `roadmap.mdx` | `apps/portfolio/content/docs/documentation/roadmap.mdx` | 4,492 | 43 | 1,123 | 0.6% |
| **conventionsPaths total** | | **46,094** | **456** | **11,521** | **5.8%** |

### 1.6 Auto-memory files

Loaded automatically because they exist in the project memory store.

| File | Full path | Bytes | Est. tokens | Notes |
|------|-----------|-------|-------------|-------|
| `MEMORY.md` | `~/.claude/projects/C--Users-benja-Documents-custom-portfolio/memory/MEMORY.md` | 175 | 43 | Index only; always loaded |
| `project_gad_architecture.md` | `~/.claude/projects/.../memory/project_gad_architecture.md` | 3,805 | 951 | Full GAD arch spec |
| **Memory subtotal** | | **3,980** | **994** | **0.5%** |

### 1.7 Git status injection

Injected at session start by Claude Code automatically.

| Item | Est. tokens |
|------|-------------|
| Current branch, main branch | ~20 |
| `git status` short output | ~50 |
| Last 5 commit hashes + messages | ~100 |
| **Git status subtotal** | **~170** |

### 1.8 Baseline total (post-/clear, before first user message)

| Category | Est. tokens | % of 200K |
|----------|-------------|-----------|
| System prompt (Anthropic) | 7,000 | 3.5% |
| Main tool schemas (9) | 4,000 | 2.0% |
| Skill list (82 skills) | 1,800 | 0.9% |
| conventionsPaths (5 files) | 11,521 | 5.8% |
| Memory files | 994 | 0.5% |
| Git status | 170 | 0.1% |
| Deferred tools (typical 6-8 loaded) | 1,400 | 0.7% |
| **Total baseline** | **~26,885** | **~13.4%** |

> **This is why the orange bar shows ~16-18% immediately after `/clear`** — the model is already pre-loaded with ~27K tokens of fixed overhead before any user message arrives.

---

## 2. Per-Turn Overhead

### 2.1 Hook scripts

Hooks are configured in `~/.claude/settings.json`. They run as Node.js scripts and inject text into the model context via `hookSpecificOutput.additionalContext`.

#### Hook configuration (from `~/.claude/settings.json`)

```json
{
  "hooks": {
    "SessionStart": [
      { "command": "node ~/.claude/hooks/gsd-check-update.js" }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash|Edit|Write|MultiEdit|Agent|Task",
        "command": "node ~/.claude/hooks/gsd-context-monitor.js",
        "timeout": 10
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "node ~/.claude/hooks/gsd-prompt-guard.js",
        "timeout": 5
      }
    ]
  },
  "statusLine": {
    "command": "node ~/.claude/hooks/gsd-statusline.js"
  }
}
```

#### Hook details

| Hook file | Full path | Script bytes | Event | Matcher | Fires on | Output injected |
|-----------|-----------|-------------|-------|---------|----------|-----------------|
| `gsd-context-monitor.js` | `~/.claude/hooks/gsd-context-monitor.js` | 6,051 | PostToolUse | `Bash\|Edit\|Write\|MultiEdit\|Agent\|Task` | Every code/file tool call | Context % warning string |
| `gsd-prompt-guard.js` | `~/.claude/hooks/gsd-prompt-guard.js` | 3,438 | PreToolUse | `Write\|Edit` | Every file write/edit | Prompt injection warning (if triggered) |
| `gsd-workflow-guard.js` | `~/.claude/hooks/gsd-workflow-guard.js` | 3,357 | PreToolUse | `Write\|Edit` | Every file write/edit | Workflow advisory (if outside GSD context) |
| `gsd-check-update.js` | `~/.claude/hooks/gsd-check-update.js` | 4,310 | SessionStart | (all) | Once per session | Update check result |
| `gsd-statusline.js` | `~/.claude/hooks/gsd-statusline.js` | 4,704 | StatusLine | (all) | Continuous (UI only) | Renders status bar — NOT injected into model context |

#### What each hook injects

**`gsd-context-monitor.js`** (PostToolUse — fires on every `Bash|Edit|Write|MultiEdit|Agent|Task`):

```
Levels triggered and exact strings injected:
  < 70% used  → nothing injected
  70–80% used → "CONTEXT WARNING: Usage at X%. Remaining: Y%. Be aware that context is getting limited..."
  80–90% used → "CONTEXT MONITOR WARNING: Usage at X%. Remaining: Y%. Begin wrapping up current task..."
  > 90% used  → "CONTEXT CRITICAL: Usage at X%. Remaining: Y%. Context is nearly exhausted..."
```

Each warning string is ~120-180 chars = ~30-45 tokens per fire.

**`gsd-prompt-guard.js`** (PreToolUse — fires on every `Write|Edit`):

```
Only fires output if injection pattern detected in file content.
Normal writes: ~0 tokens injected
Pattern detected: "⚠️ PROMPT INJECTION WARNING: Content being written to <filename>..."
Est. warning size: ~200 chars = ~50 tokens
```

**`gsd-workflow-guard.js`** (PreToolUse — fires on every `Write|Edit`):

```
Only fires output if editing outside .planning/ and not in a GSD context.
Normal GSD-context edits: ~0 tokens injected
Outside-context advisory: "⚠️ WORKFLOW ADVISORY: You're editing <filename> directly without a GSD command..."
Est. advisory size: ~250 chars = ~63 tokens
```

#### Per-session hook accumulation (30-tool-call session)

| Hook | Fires per session | Tokens per fire | Total tokens |
|------|------------------|----------------|--------------|
| gsd-context-monitor | ~30 (all Bash/Edit/Write/Agent/Task calls) | 0–45 (escalates) | ~300–900 |
| gsd-prompt-guard | ~15 (Write/Edit only) | 0 (no pattern) | ~0 |
| gsd-workflow-guard | ~15 (Write/Edit only) | 0–63 (only outside GSD) | ~0–300 |
| gsd-check-update | 1 (session start) | ~50 | ~50 |
| **Hook total** | | | **~350–1,250** |

> Hooks are far less costly than they appear — most fire with 0 output unless triggered. The context-monitor is the one that always fires once past 70%.

---

## 3. The session.md vs STATE.xml question

### 3.1 Why session.md exists instead of using STATE.xml

`STATE.xml` is the canonical **project-level** planning state. `session.md` is a **session-level** interruption handoff. They serve different purposes:

| Dimension | `STATE.xml` | `session.md` |
|-----------|-------------|--------------|
| **Purpose** | Track current phase, next action, references for the living planning loop | Record exactly where an interrupted coding session stopped |
| **Granularity** | Phase / milestone level | Task / sub-task level ("stopped after writing X, next do Y") |
| **Schema** | Structured XML (`<current-phase>`, `<next-action>`, `<references>`) | Free-form Markdown scratchpad |
| **Audience** | RP CLI, gad CLI, planning tools | Claude Code agent on next session start |
| **Update frequency** | After phase completion | After any mid-session interruption |
| **Location** | `.planning/STATE.xml` | `.planning/session.md` |
| **Bytes (current)** | 3,333 | 2,710 |
| **Format** | XML | Markdown |
| **Auto-loaded?** | No (not in conventionsPaths) | No (read by resume-project workflow) |

`STATE.xml` does not have a field for "I was halfway through writing function X when context ran out." That's session context, not project state. Writing it into `STATE.xml` would mean every interrupted session corrupts the project's planning record.

### 3.2 What STATE.xml currently contains

Full path: `.planning/STATE.xml` (3,333 bytes, ~833 tokens)

```xml
Fields present:
  <current-phase>   — active task ID (e.g. "03-02")
  <next-action>     — one-line description of next concrete step
  <milestone>       — current milestone name
  <status>          — active / blocked / complete
  <references>      — pointers to AGENTS.md, planning docs
  <session>         — last session date (not a handoff — just a timestamp)
```

### 3.3 What ROADMAP.xml and TASK-REGISTRY.xml contain

| File | Bytes | Est. tokens | Contents |
|------|-------|-------------|----------|
| `ROADMAP.xml` | 2,869 | 717 | Phase IDs, goals, status (planned/active/done), depends |
| `TASK-REGISTRY.xml` | 13,700 | 3,425 | All tasks across phases: id, goal, keywords, commands, depends, status |
| `STATE.xml` | 3,333 | 833 | Current position, next action, references |
| `DECISIONS.xml` | (unmeasured) | ~200 | Architecture decision records |
| `REQUIREMENTS.xml` | (stub) | ~50 | Pointer only — no narrative content |

---

## 4. Duplication Analysis

### 4.1 requirements.mdx — where does this information also live?

`requirements.mdx` is 10,119 bytes / 2,529 tokens and is loaded every session. Here is every place the same information also exists:

| Location | Type | Staleness | Tokens |
|----------|------|-----------|--------|
| `apps/portfolio/content/docs/documentation/requirements.mdx` | Full narrative (auto-loaded) | Always current | 2,529 |
| `apps/portfolio/content/docs/global/requirements.mdx` | Global requirements (not loaded) | Always current | ~800 |
| `apps/portfolio/content/docs/global/planning/state.mdx` (loaded) | Cross-cutting queue — subset of requirements as open/done rows | Current | included in 2,910 |
| `.planning/REQUIREMENTS.xml` | **Stub only** — just pointers to requirements.mdx | Current | ~50 |
| `.planning/TASK-REGISTRY.xml` | Task goals derive from requirements — implicit overlap | Current | 3,425 (not loaded) |
| `.planning/ROADMAP.xml` | Phase goals derive from requirements | Current | 717 (not loaded) |
| `git log` | Every requirements change is committed with context | Historical | On demand |
| Section `requirements.mdx` files | Per-section refinements (`books/`, `listen/`, etc.) | Current | Not loaded |

**Duplication verdict:** The loaded `requirements.mdx` duplicates ~40% of its content with `state.mdx` (which is also loaded). `state.mdx` cross-cutting queue is essentially requirements-status. Loading both means ~1,000 tokens of duplicate information on every session.

### 4.2 state.mdx — where does this information also live?

`state.mdx` (`documentation/planning/state.mdx`) is 11,643 bytes / 2,910 tokens and contains:
- Registry (section, owner, status, updated)
- Current cycle (phase, focus, constraint)
- Next queue (priority-ordered action items)
- Cross-cutting queue (open/done items across all sections)
- References table

| Information in state.mdx | Also exists at | Tokens saved if removed |
|--------------------------|---------------|------------------------|
| Current phase identity | `STATE.xml` (not loaded) | ~100 |
| Next queue priorities | `STATE.xml` next-action + `TASK-REGISTRY.xml` | ~400 |
| Cross-cutting queue (open items) | Global planning state.mdx (not loaded) | ~800 |
| Cross-cutting queue (done items) | **Git log** — every done item has a commit | ~600 |
| References table | `AGENTS.md` already links the same paths | ~200 |

**Done items in the cross-cutting queue are the biggest waste.** There are 11 `done` rows in the cross-cutting queue. Each one is ~60-100 chars. That's ~600 tokens describing work that is complete and already recorded in git. Git is the authoritative source for what's done — commit messages, merge commits, and the code itself.

### 4.3 AGENTS.md (root) — where does this information also live?

`AGENTS.md` is 12,389 bytes / 3,097 tokens and contains:
- Global-first workflow description
- Section registry table (20+ sections)
- Submodule / vendor policy
- Public site copy guidelines
- Planning loop description

| Section of AGENTS.md | Also exists at | Could be on-demand? |
|----------------------|---------------|---------------------|
| Global workflow description | `.planning/AGENTS.md` (also loaded, 1,862 tokens) | Yes — redundant with .planning/AGENTS.md |
| Section registry table | Can be derived from `ls apps/portfolio/content/docs/` | Yes |
| Vendor/submodule policy | Git blame + submodule config | Yes |
| Public site copy guidelines | Only here | **No — unique** |
| Planning loop description | `.planning/AGENTS.md` duplicates this | Yes |

**Both AGENTS.md and .planning/AGENTS.md are loaded.** They overlap significantly on the planning loop description. That's ~1,000 tokens of duplication.

---

## 5. Scientific Context Budget

### 5.1 Current usage breakdown (post-/clear)

```
200,000 token window
│
├── Fixed overhead (Anthropic system prompt + tools + skills)
│   ├── System prompt:        7,000  (3.5%)
│   ├── Main tool schemas:    4,000  (2.0%)
│   └── Skill list:           1,800  (0.9%)
│                           ───────
│                           12,800  (6.4%)
│
├── Project context (conventionsPaths + memory)
│   ├── AGENTS.md (root):     3,097  (1.5%)
│   ├── state.mdx:            2,910  (1.5%)
│   ├── requirements.mdx:     2,529  (1.3%)
│   ├── .planning/AGENTS.md:  1,862  (0.9%)
│   ├── roadmap.mdx:          1,123  (0.6%)
│   └── Memory files:           994  (0.5%)
│                           ───────
│                           12,515  (6.3%)
│
├── Session infrastructure
│   ├── Git status:             170  (0.1%)
│   └── Deferred tools loaded: 1,400  (0.7%)
│                           ───────
│                            1,570  (0.8%)
│
├── BASELINE TOTAL:          26,885  (13.4%)
│
└── Available for work:     173,115  (86.6%)
```

### 5.2 How a session burns to 90%

Starting at 13.4% baseline, reaching 90% means consuming 153,115 more tokens (~76,558 words of text).

| Activity | Tokens consumed | Running total |
|----------|----------------|---------------|
| Baseline (post-/clear) | 26,885 | 26,885 (13.4%) |
| First user message (this prompt) | ~100 | 26,985 |
| Read session.md (2,710 bytes) | ~678 | 27,663 |
| Read 3 planning files (10KB each) | ~7,500 | 35,163 |
| Read 5 source files (15KB each) | ~18,750 | 53,913 (27%) |
| Write 3 files (10KB each) | ~7,500 | 61,413 |
| 20 Bash commands + output (avg 1KB each) | ~5,000 | 66,413 (33%) |
| Hook injections (context warnings, 30 calls) | ~900 | 67,313 |
| Assistant responses (5 × 800 tokens) | ~4,000 | 71,313 (36%) |
| Read 5 more files + test output | ~25,000 | 96,313 (48%) |
| Second coding push (20 more tool calls) | ~50,000 | 146,313 (73%) |
| Hook warnings escalate (>70% threshold) | ~600 | 146,913 |
| User messages + responses | ~10,000 | 156,913 (78%) |
| Final file reads + bash output | ~25,000 | 181,913 (91%) |

**A normal 50-60 tool-call coding session hits 90% in ~2-3 hours of active work.** The bottleneck is source file content (reading large files), not hooks.

### 5.3 The deferred tool fetch cost

Every time `ToolSearch` is called to load a deferred tool, the schema is permanently added to the context for the rest of the session. In the loop session earlier:
- `CronCreate` fetched: +350 tokens
- `CronDelete` fetched: +150 tokens
- `TaskCreate/List/etc.` fetched: +1,200 tokens

Total: ~1,700 tokens from deferred tool fetches. These cannot be unloaded.

---

## 6. Where Information Lives — Canonical Source Map

| Information need | Canonical source | Auto-loaded? | Alt. access method | Tokens (loaded) |
|-----------------|-----------------|-------------|-------------------|----------------|
| What's the current phase? | `STATE.xml` → `<current-phase>` | No | `gad state show` | 833 (on demand) |
| What tasks are in-progress? | `TASK-REGISTRY.xml` | No | `gad tasks list` | 3,425 (on demand) |
| What phases exist? | `ROADMAP.xml` | No | `gad phases list` | 717 (on demand) |
| Architecture decisions | `DECISIONS.xml` + section `decisions.mdx` | No | `gad` or direct read | On demand |
| Project requirements | `requirements.mdx` | **Yes** | Read on demand | 2,529 (wasted) |
| Cross-cutting open items | `global/planning/state.mdx` | No | Direct read | On demand |
| What's done (history) | **Git log** | No | `git log --oneline` | ~50 per query |
| Section structure | `ls apps/portfolio/content/docs/` | No | Bash | ~100 per query |
| Vendor/submodule policy | `AGENTS.md` root | **Yes** | Already in .planning/AGENTS.md | 3,097 (partial dupe) |
| Planning loop rules | `.planning/AGENTS.md` | **Yes** | — | 1,862 |
| Auth config | `apps/portfolio/lib/auth/config.ts` | No | Read on demand | ~200 per read |
| Session interruption state | `.planning/session.md` | No | Read by resume workflow | 677 per read |

---

## 7. Scientific Recommendations

These are **not proposed changes** — they are quantified options with tradeoffs:

| Option | Token savings | Tradeoff | Difficulty |
|--------|--------------|----------|------------|
| Remove `requirements.mdx` from conventionsPaths | **-2,529** | Must read on demand when working on requirements | Low — remove one line from planning-config.toml |
| Remove `roadmap.mdx` from conventionsPaths | **-1,123** | Must read on demand; `gad phases list` covers it | Low |
| Trim done rows from `state.mdx` cross-cutting queue | **-600** | Slightly less history visible without git | Low — archive done rows |
| Move planning loop desc from root AGENTS.md to .planning/AGENTS.md only | **-1,000** | Root AGENTS.md gets shorter | Medium — careful editing |
| Split conventionsPaths into `minimal` (2 files) and `full` (5 files) profiles | **-3,652 (minimal)** | Needs tool support or two config files | Medium |
| Trim project_gad_architecture.md memory (stale since arch is now built) | **-951** | Less automatic context on GAD questions | Low — run `gad:forget` |
| Reduce context-monitor warning verbosity (shorter strings) | **-200/session** | Less readable warnings | Low — edit hook script |
| Load deferred tools lazily (already how it works — just don't ToolSearch unnecessarily) | **-1,700** | No change needed — just avoid unnecessary ToolSearch calls | None |

**Maximum token savings if all applied:** ~11,755 tokens (~6% of window)  
**Post-savings baseline:** ~15,130 tokens (~7.6%)  
**Sessions would reach 90% context later** — roughly 20-30% more tool calls before hitting the wall.

---

## 8. Reference Numbers

| Metric | Value |
|--------|-------|
| Context window (claude-sonnet-4-6) | 200,000 tokens |
| Max output (standard) | 16,384 tokens |
| Max output (extended thinking) | 64,000 tokens |
| Tokens per byte (English prose) | ~0.25 |
| Tokens per byte (code) | ~0.30 |
| Tokens per line (avg 40-char lines) | ~0.10 |
| Baseline cost (current config) | ~26,885 tokens (13.4%) |
| Baseline cost (optimized config) | ~15,130 tokens (7.6%) |
| Typical session duration before 90% | ~50-60 tool calls |
| Hook overhead (30-call session) | ~350-1,250 tokens |
| `TASK-REGISTRY.xml` if loaded | 3,425 tokens — **biggest single planning file** |
| `requirements.mdx` loaded vs on-demand | 2,529 tokens every session vs ~50 tokens per query via gad |
