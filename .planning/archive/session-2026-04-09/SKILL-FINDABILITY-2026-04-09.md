# Skill Findability Investigation — 2026-04-09

**Written by:** Claude Code at user direction.
**Purpose:** Honest answers to the questions "are our skills findable?" and "what does `gad install` actually ship?". Captures evidence from the install.js code + the agentskills.io standard + the Anthropic skills guide, then names the gaps.

---

## TL;DR

1. **`gad install` does NOT ship the `skills/` directory at all.** It ships `commands/gad/*.md` converted to slash-command skills, the bundled `get-anything-done/` skill directory, and `agents/*.md`. Everything under `skills/` — including the fundamental triumvirate (create-skill / merge-skill / find-skills per gad-73) and the new emergent `session-discipline` — is **only usable by agents working inside the GAD repo itself**. A user who runs `gad install --claude` in their own project does not get these skills.
2. **We are not using the agentskills.io cross-client convention.** Skills live at `skills/` (repo-root, Claude-Code-only convention). The agentskills.io standard uses `.agents/skills/` for cross-client interoperability. Adopting the standard would make our skills visible to Codex, Cursor, Windsurf, Augment, and any other compliant client — a prerequisite for the codex-vs-claude comparison eval (task 89).
3. **The `excluded-from-default-install: true` flag I added to session-discipline in the previous turn is currently cosmetic** — the installer does not read it because the installer does not copy the workspace `skills/` directory at all.
4. **Emergent skills are findable to agents working inside this repo**, via file-read. They are NOT findable to an agent running `gad install` in a different repo. This is actually the correct behavior for emergent skills (they are agent-authored, repo-specific, and should not leak), but the same gap affects human-authored workspace skills that SHOULD be shared.
5. **The agentskills.io evaluation methodology is directly applicable to us** and we should adopt it. Specifically: `evals/evals.json` per skill with `with_skill` vs `without_skill` baseline runs, assertion-based grading, `benchmark.json` aggregation, iteration loop. This is exactly the programmatic evaluation framework gad-69 is asking for, and it's already a documented standard we can adopt rather than invent.

---

## Evidence

### 1. What `gad install` actually copies

From `vendor/get-anything-done/bin/install.js`:

**For Claude Code install** (`install(isGlobal, 'claude')` → line 4670-4692):

```js
// Claude Code: skills/ format (2.1.88+ compatibility)
const skillsDir = path.join(targetDir, 'skills');
const gadSrc = path.join(src, 'commands', 'gad');
copyCommandsAsClaudeSkills(gadSrc, skillsDir, 'gad', pathPrefix, runtime, isGlobal);
```

That `gadSrc` is `commands/gad/*.md` — the slash commands — NOT `skills/*`. The installer converts each slash command into a Claude-Code `SKILL.md` file and drops it under the target's `skills/gad-*/` directory. The source `skills/` directory (where create-skill, merge-skill, portfolio-sync, session-discipline, etc. live) is never read by this code path.

The same is true for Codex (line 4588), Copilot (4598), Antigravity (4614), Cursor (4629), Windsurf (4639), Augment (4649). All of them install the `commands/gad/` slash commands, not the workspace skills.

**One exception** — line 4699-4710:

```js
const skillSrc = path.join(src, 'get-anything-done');
if (fs.existsSync(skillSrc)) {
  // ... copies a SINGLE bundled skill called "get-anything-done"
}
```

This copies a single bundled skill directory named `get-anything-done/`. Line 4708-4710 notes it's absent from local git checkouts — the directory is generated during `npm publish`. So only npm-published installs get this one extra skill. Local-clone installs don't get it either.

**Conclusion:** `gad install` installs:
- `commands/gad/*.md` converted to slash commands (the `gad-*` slash skills)
- `agents/*.md` (the subagents)
- The single bundled `get-anything-done/` skill (npm-published installs only)

It does **NOT** install:
- Any of the 27+ skills under `vendor/get-anything-done/skills/`
- Any of the emergent skills under `vendor/get-anything-done/skills/emergent/`

### 2. What the agentskills.io standard says about skill discovery

Per [https://agentskills.io/client-implementation/adding-skills-support](https://agentskills.io/client-implementation/adding-skills-support):

> Most locally-running agents scan at least two scopes:
> - **Project-level** (relative to the working directory): Skills specific to a project or repository.
> - **User-level** (relative to the home directory): Skills available across all projects for a given user.
>
> Within each scope, consider scanning both a **client-specific directory** and the **`.agents/skills/` convention**:
>
> | Scope | Path | Purpose |
> |---|---|---|
> | Project | `<project>/.<your-client>/skills/` | Your client's native location |
> | Project | `<project>/.agents/skills/` | Cross-client interoperability |
> | User | `~/.<your-client>/skills/` | Your client's native location |
> | User | `~/.agents/skills/` | Cross-client interoperability |
>
> The `.agents/skills/` paths have emerged as a widely-adopted convention for cross-client skill sharing.

**Implication for GAD:** Our workspace skills at `vendor/get-anything-done/skills/` are at neither a client-specific location nor the `.agents/skills/` convention. They are findable by agents whose working directory is `vendor/get-anything-done/` (because Claude Code appears to fall back to scanning parent directories or repo root) but the convention is undocumented and client-dependent.

### 3. Name collision handling per the standard

Per the same page:

> The universal convention across existing implementations: **project-level skills override user-level skills.** Within the same scope... either first-found or last-found is acceptable — pick one and be consistent. Log a warning when a collision occurs so the user knows a skill was shadowed.

We do not currently detect skill collisions. If two of our skills had overlapping descriptions (ambiguous routing), nothing would warn us. The user's ChatGPT conversation flagged this as the primary failure mode of large skill libraries.

### 4. Evaluation methodology per the standard

Per [https://agentskills.io/skill-creation/evaluating-skills](https://agentskills.io/skill-creation/evaluating-skills):

The standard methodology is:

1. **Test cases** stored in `evals/evals.json` inside the skill directory, with `prompt`, `expected_output`, optional `files`, and `assertions`.
2. **Run each test case twice**: once `with_skill` and once `without_skill` (or `old_skill` as baseline).
3. **Capture timing** (`total_tokens` + `duration_ms`) per run.
4. **Grade each assertion** PASS/FAIL with concrete evidence.
5. **Aggregate to `benchmark.json`** with per-configuration pass_rate / time / tokens means + stddev + delta.
6. **Iterate** on the skill using failed assertions + human feedback + execution transcripts as signals.

**This is exactly what we should be doing for skill evaluation.** Our current rubric is for eval PROJECTS (build an escape-the-dungeon game), not for SKILLS. The skill-level evaluation is a gap.

### 5. Progressive disclosure cost

Per the standard:

| Tier | What's loaded | When | Token cost |
|---|---|---|---|
| 1. Catalog | Name + description | Session start | ~50-100 tokens per skill |
| 2. Instructions | Full SKILL.md body | When activated | <5000 tokens (recommended) |
| 3. Resources | Scripts, references, assets | On-demand | Varies |

We have ~27 skills × ~75 tokens = ~2000 tokens for the catalog alone. Not terrible, but it scales linearly. If we grow to 100+ skills without pruning, the catalog becomes a meaningful context cost.

**The standard's solution:** name collision detection + skill merging (merge-skill) + filtering (hide disabled skills from catalog) + session activation tracking.

---

## What the user actually asked

### Q: Are the emergent skills findable in our system?

**Inside the GAD repo itself, by agents working there**: yes, as long as the working directory is under `vendor/get-anything-done/` or the parent. Claude Code scans `skills/` at the repo root and picks them up. Codex and other runtimes may or may not — they use different conventions.

**To a user who installs GAD via `gad install`**: no. The installer doesn't copy `skills/` at all. This is true for the emergent skills AND for every other workspace skill.

**Correct behavior for which kind of skill:**
- Emergent skills: the no-install behavior is correct. They are agent-authored, repo-specific, and should not leak.
- Human-authored workspace skills that would benefit users: the no-install behavior is a bug. The fundamental triumvirate from gad-73 (find-skills / merge-skill / create-skill) specifically should be installable so users can do evolution in their own projects.

### Q: Can Claude Code or Codex use them if installed using GAD?

**No.** Not because of a Codex/Claude difference, but because `gad install` doesn't ship them at all. Both runtimes would be equally empty on this axis.

### Q: What are the keywords that usually can trigger our skills?

This is a real question — we have 27 skills with descriptions but no central view of their trigger keywords. I'll scan and produce a keyword map as a separate deliverable in this turn.

### Q: Will having a lot of skills degrade performance?

**Per the standard:** progressive disclosure (tier 1 = catalog only) mitigates the biggest failure mode (context saturation). 27 skills × 75 tokens = ~2000 tokens is manageable. The bigger risks are:

1. **Skill collision** — two skills with overlapping descriptions → ambiguous routing → the agent picks wrong or thrashes.
2. **Description dilution** — generic descriptions lose trigger specificity → under-triggering or over-triggering.
3. **Retrieval noise** (for embedding-based systems, not applicable to us yet).

**Our mitigation plan** (captured as gad-81 below):
- Hard cap of 3-7 active skills per task (encourage the agent to select deliberately).
- Run a periodic collision detection scan across skill descriptions.
- Use merge-skill (when it exists) to fuse overlapping skills.
- Measure per-skill effectiveness via the agentskills.io `with_skill` vs `without_skill` methodology.

---

## Gaps identified (queued as new tasks)

1. **Adopt `.agents/skills/` convention** for cross-client interoperability. Move or symlink installable skills to `.agents/skills/` and update `install.js` to copy both paths for supported runtimes. Required for the codex-vs-claude comparison eval.
2. **Install fundamental triumvirate to user workspaces**. `gad install` should copy `skills/create-skill/`, `skills/merge-skill/`, `skills/find-skills/` (once they exist) to the user's workspace so they can do emergent evolution in their own projects.
3. **Exclude emergent skills from install** explicitly. The `excluded-from-default-install: true` flag needs to be honored by the installer.
4. **Adopt the agentskills.io skill evaluation methodology**. Per-skill `evals/evals.json` + `with_skill` vs `without_skill` baseline runs. This is the programmatic skill-effectiveness signal gad-69 is asking for.
5. **Skill collision detection at prebuild**. Scan every skill description for overlapping trigger patterns. Emit warnings. Propose merge candidates via merge-skill.
6. **Verify eval worktree isolation**. Eval runs live under `.claude/worktrees/agent-*/` inside the parent repo. Do they inherit our `.claude/settings.json` hooks? Our workspace skills? If yes, evals are contaminated by monorepo install state. Needs investigation.
7. **Cite the Anthropic skills guide + agentskills.io on every skill-related page**. Currently only gad-70 references the Anthropic PDF. /security links it once. /skills does not cite either. /methodology does not cite either.
