# GAD Skills

Agent-agnostic skill definitions for the GAD framework. Each skill is a methodology document — it works with any AI coding assistant, not just Claude Code.

## Skill catalog

| Skill | Directory | Description |
|-------|-----------|-------------|
| `gad:execute-phase` | `execute-phase/` | Execute a planned phase atomically — commit per task, update planning docs, run verify |
| `gad:plan-phase` | `plan-phase/` | Plan a phase: kickoff, scope, definition of done, task breakdown |
| `gad:new-project` | `new-project/` | Initialize a project with full GAD planning structure |
| `gad:verify-work` | `verify-work/` | Verify a completed phase achieved its goals — pass/fail per DoD criterion |
| `gad:map-codebase` | `map-codebase/` | Analyze an existing codebase; produce stack/arch/concern documents |
| `gad:check-todos` | `check-todos/` | Read state and surface the single best next action |
| `gad:add-todo` | `add-todo/` | Capture an idea or follow-up without losing execution flow |
| `gad:debug` | `debug/` | Systematic debugging — hypotheses, tests, root cause, debug session file |
| `gad:quick` | `quick/` | Execute a scoped ad-hoc task with planning guarantees but without full ceremony |
| `gad:audit-milestone` | `audit-milestone/` | Audit a milestone for gaps before archiving |
| `gad:new-milestone` | `new-milestone/` | Start a new milestone — reset state, open new roadmap cycle |
| `gad:complete-milestone` | `complete-milestone/` | Close a milestone — verify, tag, archive |
| `gad:manuscript` | `manuscript/` | Fiction and creative writing adaptation — manuscript loop with beats, canon locks, FQs |
| `gad:eval-run` | `eval-run/` | Run a GAD evaluation — declare context mode, plan/execute against requirements, write trace |
| `gad:eval-report` | `eval-report/` | Generate fresh vs loaded context comparison report across eval runs |

## Migration map — rp-* → gad:*

| Legacy skill | GAD equivalent | Notes |
|-------------|----------------|-------|
| `rp-session` | `gad session` CLI | Replaced by `gad session new/resume/close` + `gad context` |
| `rp-execute-phase` | `gad:execute-phase` | Same methodology |
| `rp-plan-phase` | `gad:plan-phase` | Same methodology |
| `rp-new-project` | `gad:new-project` | Same methodology |
| `rp-verify-work` | `gad:verify-work` | Same methodology |
| `rp-map-codebase` | `gad:map-codebase` | Same methodology |
| `rp-check-todos` | `gad:check-todos` | Same methodology |
| `rp-add-todo` | `gad:add-todo` | Same methodology |
| `rp-debug` | `gad:debug` | Same methodology |
| `rp-quick` | `gad:quick` | Same methodology |
| `rp-milestone` | `gad:audit-milestone` + `gad:new-milestone` + `gad:complete-milestone` | Split into three focused skills |
| `rp-manuscript` | `gad:manuscript` | Migrated — full content in `manuscript/SKILL.md` |

## Agent install

Skills in this directory are the canonical source. Copy the relevant `SKILL.md` files into your agent's skill loader:

- **Claude Code:** `~/.claude/get-shit-done/workflows/<skill-name>.md` (content) or `~/.claude/commands/gsd/<skill-name>.md` (slash command)
- **Other agents:** Follow the agent's skill/workflow loading convention

## Format

Each skill is a directory with:
```
<skill-name>/
  SKILL.md   — frontmatter (name, description) + agent-agnostic methodology
```
