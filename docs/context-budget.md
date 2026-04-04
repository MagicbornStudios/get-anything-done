# Claude Code Context Budget — Sonnet 4.6

**Model:** claude-sonnet-4-6  
**Context window:** 200,000 tokens  
**Token estimate method:** bytes ÷ 4 (standard English approximation)  
**Measured:** 2026-04-04, custom_portfolio project

---

## Summary table

| Layer | Source | Bytes | ~Tokens | % of 200K |
|-------|--------|-------|---------|-----------|
| System prompt (Claude Code core) | Anthropic-injected | ~28,000 | ~7,000 | 3.5% |
| Tool schemas — main (9 tools) | System prompt | ~18,000 | ~4,500 | 2.3% |
| Tool schemas — deferred (23 tools) | Loaded on ToolSearch | ~24,000 | ~6,000 | 3.0% |
| Skill list (80+ skills in system-reminder) | System prompt | ~8,000 | ~2,000 | 1.0% |
| Git status injection | Session start | ~800 | ~200 | 0.1% |
| **conventionsPaths — AGENTS.md (root)** | planning-config.toml | 12,389 | **3,097** | **1.5%** |
| **conventionsPaths — .planning/AGENTS.md** | planning-config.toml | 7,451 | **1,862** | **0.9%** |
| **conventionsPaths — requirements.mdx** | planning-config.toml | 10,119 | **2,529** | **1.3%** |
| **conventionsPaths — state.mdx** | planning-config.toml | 11,643 | **2,910** | **1.5%** |
| **conventionsPaths — roadmap.mdx** | planning-config.toml | 4,492 | **1,123** | **0.6%** |
| Memory — MEMORY.md index | Auto-memory | 175 | 43 | <0.1% |
| Memory — project_gad_architecture.md | Auto-memory | 3,805 | 951 | 0.5% |
| Hook output — gsd-context-monitor.js | PostToolUse hook | ~500/turn | ~125/turn | per-turn |
| Hook output — gsd-prompt-guard.js | PreToolUse hook | ~300/turn | ~75/turn | per-turn |
| Hook output — gsd-workflow-guard.js | PreToolUse hook | ~300/turn | ~75/turn | per-turn |
| Hook output — gsd-statusline.js | Notification hook | ~200/turn | ~50/turn | per-turn |
| **Baseline total (before any message)** | | **~130,000** | **~32,290** | **~16%** |

---

## Fixed baseline detail

### System prompt (Claude Code core) — ~7,000 tokens

Anthropic-injected. Includes:
- Identity + behavioral instructions (~3,000 tokens)
- Tool use formatting rules (~1,000 tokens)
- Committing/PR/git safety protocols (~1,500 tokens)
- Tone, output efficiency, environment block (~1,000 tokens)
- Session-specific guidance (~500 tokens)

### Main tool schemas — ~4,500 tokens

9 tools always loaded with full JSON schemas:

| Tool | Est. tokens |
|------|-------------|
| Agent | ~900 (large description + subagent_type enum) |
| Bash | ~700 (long description with examples) |
| Grep | ~600 (many params + output_mode enum) |
| Edit | ~400 |
| Read | ~350 |
| Write | ~300 |
| Skill | ~300 |
| Glob | ~250 |
| ToolSearch | ~200 |
| **Total** | **~4,000** |

### Deferred tool schemas — ~6,000 tokens (when fetched)

23 tools listed by name only until `ToolSearch` fetches them. Each fetch loads ~200-400 tokens per tool schema. In a typical session that uses tasks/crons/web, 8-12 are fetched, adding 2,000-5,000 tokens mid-session.

| Category | Tools | Est. tokens when all fetched |
|----------|-------|------|
| Task management | TaskCreate, TaskGet, TaskList, TaskOutput, TaskStop, TaskUpdate | ~1,500 |
| Cron | CronCreate, CronDelete, CronList | ~600 |
| Planning mode | EnterPlanMode, ExitPlanMode, EnterWorktree, ExitWorktree | ~600 |
| Web | WebFetch, WebSearch | ~400 |
| MCP — IDE | mcp__ide__executeCode, mcp__ide__getDiagnostics | ~400 |
| MCP — SaaS | mcp__claude_ai_Gmail, mcp__claude_ai_Google_Calendar, mcp__claude_ai_Notion | ~600 |
| Other | AskUserQuestion, NotebookEdit, RemoteTrigger | ~400 |
| **Total if all fetched** | | **~4,500** |

### Skill list — ~2,000 tokens

80+ skills listed in system-reminder with name + short description each. Always present.
Includes: gsd:*, rp-*, update-config, keybindings-help, frontend-design, shadcn, etc.

### conventionsPaths — 11,521 tokens total

Loaded from `planning-config.toml` on every session start:

| File | Bytes | Tokens | Notes |
|------|-------|--------|-------|
| `AGENTS.md` (root) | 12,389 | 3,097 | Largest single contributor |
| `documentation/planning/state.mdx` | 11,643 | 2,910 | Cross-cutting queue, long |
| `documentation/requirements.mdx` | 10,119 | 2,529 | Full requirements narrative |
| `.planning/AGENTS.md` | 7,451 | 1,862 | XML planning layer guide |
| `documentation/roadmap.mdx` | 4,492 | 1,123 | Section roadmap |
| **Total** | **46,094** | **11,521** | |

### Memory files — ~994 tokens

| File | Bytes | Tokens |
|------|-------|--------|
| `MEMORY.md` (index) | 175 | 43 |
| `project_gad_architecture.md` | 3,805 | 951 |
| **Total** | **3,980** | **994** |

---

## Per-turn overhead

Every tool call appends hook output to the context. In an active coding session with 30+ tool calls:

| Hook | Output per fire | Fires per session | Total tokens |
|------|----------------|-------------------|--------------|
| gsd-context-monitor | ~125 tokens | Every tool call | ~3,750 |
| gsd-prompt-guard | ~75 tokens | Every tool call | ~2,250 |
| gsd-workflow-guard | ~75 tokens | Every tool call | ~2,250 |
| gsd-statusline | ~50 tokens | Every tool call | ~1,500 |
| **Total hooks @ 30 calls** | | | **~9,750** |

Tool results (file reads, bash output, search results) are the dominant per-turn cost — a single large file read can add 2,000-10,000 tokens.

---

## Why the context bar stays high after /clear

`/clear` removes **message history** but not:
- The system prompt (fixed, always injected)
- conventionsPaths files (re-injected on session start)
- Memory files (re-injected on session start)
- Skill list + tool schemas

**Post-/clear baseline: ~16% of 200K** (~32,000 tokens)

A session that reads 10 large files and runs 40 tool calls with hooks can easily reach 80-90% with zero conversation history remaining.

---

## Reduction levers

| Lever | Token savings | Effort |
|-------|--------------|--------|
| Trim `AGENTS.md` (root) — currently 146 lines | up to -2,000 | Low |
| Split `state.mdx` — remove cross-cutting queue from always-loaded | up to -2,000 | Medium |
| Move `requirements.mdx` out of conventionsPaths (read on demand) | -2,529 | Low |
| Reduce hook verbosity (gsd-context-monitor warning text) | -3,000/session | Low |
| Remove `project_gad_architecture.md` from memory (stale?) | -951 | Low |
| Split `planning-config.toml` into two profiles: minimal (2 files) + full (5 files) | -6,000 | Medium |
| **Total potential savings** | **~16,000 tokens (-8%)** | |

---

## Reference: Sonnet 4.6 limits

| Limit | Value |
|-------|-------|
| Context window | 200,000 tokens |
| Max output | 16,000 tokens (standard) / 64,000 tokens (extended thinking) |
| Approx. chars per token | 4 (English prose) |
| Approx. lines per token | 0.25 (40 chars/line avg) |
| Cost at 90% context | 180,000 tokens in window |
| Remaining for new work at 90% | ~20,000 tokens (~80KB of text) |
