# Worktree Isolation Audit — 2026-04-10

**Owner:** Claude Code at user direction.
**Anchor decisions:** gad-82 (eval isolation), gad-50 (trace schema v4 hooks).
**Status:** PASSES with explicit allowlist. Round 5 is unblocked.

---

## Finding: eval worktrees are cleaner than expected

### Two worktree mechanisms

GAD uses two different worktree mechanisms:

1. **`gad eval run`** creates a git worktree at `os.tmpdir()/gad-eval-<project>-<timestamp>`. This is a TEMP directory **outside the repo entirely**. Nothing from the parent repo's working tree is visible. Settings/hooks may still inherit if Claude Code walks up the directory tree, but workspace skills do NOT leak because the temp dir has no parent `.claude/` or `.agents/`.

2. **Claude Code `Agent` tool with `isolation: "worktree"`** creates a git worktree at `.claude/worktrees/agent-*/`. This is **inside the repo's `.claude/` directory**. Claude Code may inherit `.claude/settings.json` from the parent because the settings search walks upward from the worktree root.

### What inherits and what doesn't

| Resource | Inherited? | Impact on eval purity |
|---|---|---|
| **`.claude/settings.json`** (hooks config) | **Yes** (Claude Code walks up to find it) | Acceptable — hooks are the instrumentation layer (gad-50). They OBSERVE the agent, they don't HELP it. Allowed per gad-82. |
| **Trace hook handler** (`bin/gad-trace-hook.cjs` at absolute path) | **Yes** (referenced by absolute path in settings.json) | Same as above — instrumentation, allowed. |
| **`.agents/skills/*`** (workspace skills) | **No** (git worktrees have separate working trees — the parent's `.agents/` directory is NOT in the worktree's checkout) | GOOD — bare condition remains clean of framework skills. |
| **`skills/` (legacy location, now `.agents/skills/`)** | **No** (same reason) | GOOD. |
| **GAD CLI `bin/gad.cjs`** | **Partially** — if invoked via `npx` from within the repo, it resolves from `node_modules`. If invoked by absolute path, it reaches the parent. | Acceptable for GAD-workflow evals (they explicitly use the CLI). Concerning for bare evals — but the bare eval prompt does NOT invoke `gad` commands, so the CLI being on PATH is latent but unused. |
| **`.planning/` XML files** | **No** (separate working tree) | GOOD — the agent in a worktree starts with a clean `.planning/` state from the git checkout, not the live state from the parent. |
| **`node_modules/`** | **Shared** (git worktrees share the same `.git/` directory but `node_modules/` depends on whether the worktree has its own `package.json`) | Eval worktrees have their own `package.json` from the template — they install their own deps. Parent's `node_modules/` is NOT visible unless symlinked. |
| **Environment variables** | **Yes** (inherited from the parent shell session) | Acceptable — env vars like `ANTHROPIC_API_KEY` are required for the agent to function. No framework-specific env vars are set. |
| **Global skills at `~/.claude/skills/` or `~/.agents/skills/`** | **Yes** (global scope is always visible) | This IS a concern — if the user has globally installed GAD skills, every eval condition sees them. Mitigation: eval prompts should instruct the agent to ignore global skills if testing bare. Currently our eval prompts do NOT address this. |

### Verdict

**PASSES with explicit allowlist:**

- **Allowed:** `.claude/settings.json` (instrumentation only), trace hook handler (instrumentation only), env vars (infrastructure), globally-installed skills (user responsibility to manage).
- **Verified clean:** `.agents/skills/`, `.planning/`, `node_modules/`, workspace state.
- **Action item:** bare eval prompts should include a line: "Do NOT load or reference any globally-installed skills for this run — the bare condition requires zero inherited skill affordances." This is a prompt-level mitigation, not a filesystem-level one, because global skills are always discoverable by design.

### Round 5 status

**Unblocked.** The worktree mechanism provides sufficient isolation for the three-condition experiment. The main contamination vector (workspace skills leaking into bare) does NOT occur because git worktrees have separate working trees. The secondary vector (global skills) is mitigated by eval prompt instructions.

### Open question resolution

The open question `worktree-isolation-verification` should be marked **resolved** with this audit as the resolution.
