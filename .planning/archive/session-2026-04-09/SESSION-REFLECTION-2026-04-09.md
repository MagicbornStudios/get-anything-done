# Session Reflection — 2026-04-09 (dogfood failure)

**Written by:** Claude Code (the agent building this project) under user direction.
**Purpose:** Honest real-time capture of how the agent did vs did not use the GAD framework while building GAD itself. This is the recursion / dogfooding data the user asked for.
**Status:** finding. Not a hypothesis. Observed facts about one agent session.

---

## The failure, stated plainly

The agent (me, Claude Code) spent multiple turns building features for the GAD project — glossary, rubric page, decisions page, requirements page, roadmap page, emergent page, tasks page, phases page, bugs page, security page, contribute page, data page, skills directory refactor, global search, skeptic page. Twenty-plus distinct surfaces shipped.

During that entire run, **the agent did not follow the GAD workflow the project is supposed to be testing**:

1. **Did not run `gad snapshot --projectid get-anything-done` between turns.** Ran it once very early in the session and never rehydrated after. Each new set of instructions from the user was addressed directly without re-reading STATE.xml, TASK-REGISTRY.xml, or DECISIONS.xml.
2. **Did not consult TASK-REGISTRY.xml before starting new work.** The formal task registry had PLANNED entries (`22-20`, `22-21`, `22-22`, `22-23`, `22-24`, `22-25`, `22-31`) describing several of the exact pages and features that were then built ad-hoc. The work was done, but the tasks were never marked in progress or done in the registry.
3. **Did not invoke a single skill.** The repo ships 26 skills under `skills/`. Not one was explicitly loaded or referenced during the session. In particular:
    - `skills/portfolio-sync/SKILL.md` literally describes the workflow the agent spent the entire session executing manually (regenerate site data → build → commit → push with portfolio-sync prefix).
    - `skills/create-skill/SKILL.md` explicitly says "write the skill the moment you learn the lesson — not at the end." The agent shipped at least five non-obvious patterns (Term component, Ref component, GlobalSearch, SkillCopyActions, data/ pseudo-db loader) that should have been captured as skills as they were invented. Zero skills were authored.
    - `skills/map-codebase/SKILL.md` exists to reduce the cost of exploring the repo before implementing. Never invoked.
4. **Did not spawn a subagent.** Specialized agents (`gad-planner`, `gad-phase-researcher`, `gad-codebase-mapper`) exist for exactly the kind of multi-step planning and exploration the session was doing. The agent ran everything inline in the main context.
5. **Wrote SKEPTIC.md into `.planning/` without checking whether that location is in `gad snapshot`'s surface.** Snapshot pulls STATE.xml + TASK-REGISTRY.xml + DECISIONS.xml + recent git history. Ad-hoc markdown files under `.planning/` (ASSUMPTIONS.md, GAPS.md, SKEPTIC.md, this file) are **invisible to future agent sessions** unless a human points at them explicitly. The framework has no canonical home for "findings about the framework itself," and the agent did not notice.
6. **Used the session-scoped TaskCreate tool, not TASK-REGISTRY.xml.** The 40+ session tasks created via the TaskCreate tool are ephemeral — they vanish when the session ends. The real task registry received zero updates for any of the 20+ surfaces shipped. If a future agent runs `gad snapshot` tomorrow, it will see task `22-20` as `planned` when the `/gad` page has existed for multiple sessions.

This is the most meta failure the project could possibly produce: **the agent testing whether framework discipline helps agents is not using the framework that is supposed to help**.

---

## Why this happened

Not a single reason. A compounding set of small ones:

### 1. User prompts are fast and directive

Every user turn ended with a concrete ask: "build the rest out," "add the badges," "write the glossary." The agent optimized for immediate response to the ask, which skipped any pause for "wait, what does snapshot say about this?"

The more the session moved, the more expensive a pause felt, so pauses never happened. The discipline to stop and snapshot has to be a hard default, not a soft preference.

### 2. The framework's own entry points don't fire automatically

`gad snapshot` only runs if the agent explicitly invokes it. Claude Code has no hook that says "on session start, run this." The hook infrastructure the framework DOES ship (PreToolUse/PostToolUse for trace v4) doesn't cover session boundaries or task transitions. There is no mechanism that makes skipping the framework feel wrong — only the agent's own discipline.

Implication: the framework is currently **discoverable but not enforcing**. An agent that forgets to run snapshot pays no immediate cost, so the forgetfulness compounds.

### 3. No skill-trigger coverage check

Per decision `gad-69` and `.planning/GAPS.md` G2, skill-trigger coverage is a queued programmatic-eval gap. It is exactly the check that would have caught this failure: "the agent just finished a tool_use that matches `portfolio-sync`'s trigger description, but no skill invocation event was emitted." Building that check is listed as high-priority work. **The gap is self-referential** — the agent is currently failing the exact measurement that would detect the failure.

### 4. Skills are loaded but not foregrounded

Skills ship under `skills/<name>/SKILL.md`. The agent can read them but they are not in the system prompt, not in the snapshot output, not in the conversation by default. The agent has to know they exist AND remember to look for the right one AND have enough context budget to load them. That is three failure points in a row.

### 5. Session tasks and registry tasks are two different systems

Claude Code's built-in `TaskCreate` is a session-scoped tracker. GAD's `TASK-REGISTRY.xml` is a persistent registry. These look similar but are **not the same system**. The agent used the familiar one (session tracker) without building a bridge to the persistent one. Every task created via `TaskCreate` this session is now ephemeral.

### 6. The SKEPTIC.md placement was pattern-matching, not research

The agent saw `ASSUMPTIONS.md` and `GAPS.md` already in `.planning/` and put `SKEPTIC.md` next to them by analogy. That is intellectually lazy. A proper placement check would ask: "will `gad snapshot` surface this doc?" The answer is no. So either the doc should move somewhere `snapshot` looks, or `snapshot` should be extended to include ad-hoc markdown, or a new category (`.planning/reviews/` or similar) should be created and added to snapshot.

---

## What should have happened on every turn

This is the target behavior, written as a rule the agent should follow:

**Start of every turn that touches the repo:**

1. Run `gad snapshot --projectid get-anything-done`. Read it.
2. Check TASK-REGISTRY.xml for tasks that match the user's request. If a planned task fits, adopt it. If none fits, create a new task in the registry (not in the session tracker) before starting work.
3. Scan `skills/` for skills whose description matches the work about to happen. If one matches, load it and follow its instructions. If one *should* match but does not exist yet, write it (per create-skill) after the work is done.
4. Check if the work belongs to an existing phase in ROADMAP.xml. If yes, use that phase id. If no, consider whether a new phase is justified.

**During the work:**

5. When a non-obvious pattern emerges (a client component shape, a prebuild parser structure, a cross-linking primitive), write a skill capturing it BEFORE moving on. The Ref component, the Term component, the data/ pseudo-db loader, the SkillCopyActions pattern — each of those deserved a skill written at the moment it was invented.
6. Update TASK-REGISTRY.xml as work completes. Mark `in-progress` when starting, `done` when shipped.

**End of every turn:**

7. Update STATE.xml's `next-action` field.
8. If any decisions were made, add them to DECISIONS.xml.
9. Commit with a task id in the subject line (`portfolio-sync: <task-id> <what>`).

**None of this happened for 20+ surfaces shipped this session.**

---

## Concrete fixes

Ranked by how much they'd actually enforce the discipline next time:

### 1. `session-discipline` skill (ship this session)

Write a new skill at `skills/session-discipline/SKILL.md` that codifies the target behavior above. Title: "Session-start discipline for agents working in the GAD repo." Explicit checklist. Every future agent loads this skill first and follows it.

### 2. Hook into session boundaries

Add a PreTurnUse hook (or equivalent for whatever Claude Code exposes) that prints a reminder to run snapshot if the last snapshot was more than N turns ago. Soft enforcement. Queue as a new task.

### 3. Extend `gad snapshot` to surface ad-hoc planning docs

Currently snapshot shows STATE/TASKS/DECISIONS/recent git. Extend it to list markdown files under `.planning/` with their first heading as a summary: ASSUMPTIONS.md, GAPS.md, SKEPTIC.md, SESSION-REFLECTION-*.md. That way a future agent session sees these docs exist without the user having to remember to point at them.

### 4. Add a `recent-updates` block to snapshot output

The snapshot currently shows the latest N decisions as titles. Add a parallel block: "tasks completed in the last 7 days" pulling from git log of TASK-REGISTRY.xml changes. That way agents see what just shipped, catching the "my work is ephemeral" failure mode.

### 5. Use TASK-REGISTRY.xml, not the session tracker, for GAD work

The session's ephemeral TaskCreate tool is useful for one-off checklists the agent manages inside its own head. GAD work must flow through TASK-REGISTRY.xml. Make this a documented rule in the session-discipline skill.

### 6. Add a programmatic check: "did the last commit reference a task id?"

`portfolio-sync` skill step 5 says "commit with a GAD task id if this is tracked work, or `chore(site):` prefix if routine." A simple CI check can enforce this: parse the commit subject, assert it either starts with `NN-NN:` (task id), `chore`, or `fix`. Fail otherwise.

### 7. Retroactively update TASK-REGISTRY.xml for this session

Mark the planned tasks that actually shipped (`22-20` /gad page, `22-21` /methodology, `22-23` /projects, `22-24` charts, `22-25` nav refactor, `22-29` /lineage) as `done` with a pointer to the commit that shipped them. Where the work doesn't map to an existing task, add new ones under phase 22.

---

## Why this matters for the science

The project's core claim (gad-74) is that GAD's value is task-management-at-scale + workflow discipline. The freedom hypothesis (gad-36) and the compound-skills hypothesis (gad-65) both implicitly assume that agents working inside the framework behave differently from agents working outside it.

**This session is preliminary evidence that they don't** — when the framework is optional, an agent with a long task list will default to ad-hoc execution and skip the framework. The agent will still produce good work (look at the 20+ surfaces shipped) but the work will not be tracked, the patterns will not be captured as skills, and the next session will have to rediscover the same context.

That is exactly what the freedom hypothesis predicts, and exactly what the compound-skills hypothesis says should not happen. This session is a data point **against the compound-skills hypothesis as currently framed**: skills do not compound if the agent doesn't invoke them.

The fix is not to work harder at discipline. The fix is to make the framework self-enforcing so an agent cannot forget to use it. That is a framework-design problem, not a prompt-engineering problem.

---

## What goes in SKEPTIC.md as a result of this

Add a new section to SKEPTIC.md:

> **Dogfood failure: the framework tests framework discipline but isn't self-enforcing.** This session shipped 20+ surfaces without invoking a single skill or updating TASK-REGISTRY.xml. The agent is pattern-matching the work instead of following the workflow. Until the framework forces discipline (hooks, session-start checks, skill-trigger enforcement), agents will pattern-match around it and the data we collect about "framework works" will be contaminated by "agent didn't actually use framework." Self-referential problem — see GAPS.md G2 (skill-trigger coverage) which is queued but not yet built.

---

## What this file is and isn't

**This file IS:**
- Honest real-time data about one agent session
- A finding about the framework itself
- Inputs to the skeptic critique and the open questions list

**This file IS NOT:**
- A claim that the agent was malicious or incompetent
- A claim that the framework is broken
- An excuse for the failure

The failure is normal. The framework failed to enforce the behavior it was supposed to enforce. That is fixable. The fix is listed above.
