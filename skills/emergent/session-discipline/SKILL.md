---
name: session-discipline
origin: emergent
authored-by: agent
authored-on: 2026-04-09
excluded-from-default-install: true
description: >-
  Hard-start procedure for any agent about to touch the GAD repo in a new turn
  or session. Forces the agent to rehydrate state, check existing planned work,
  load relevant skills, and commit through the formal task registry before
  running ad-hoc. Load this skill at the start of EVERY turn that writes to the
  repo. Written after a dogfood failure in session 2026-04-09 where an agent
  shipped 20+ surfaces without invoking a single skill or updating
  TASK-REGISTRY.xml. Use when starting a session, resuming after auto-compact,
  picking up new user instructions, or noticing you have drifted into ad-hoc
  execution.
lane: dev
---

> **Emergent skill.** This skill was authored by an agent (Claude Code) in response
> to a dogfood failure, not by the repo owner. It lives under `skills/emergent/`
> and is excluded from the default install. Agents working inside this repo load
> it automatically; users who install GAD into their own workspace do not get it
> by default. See decision gad-80 for the emergent-vs-authored skill policy.

# session-discipline

The GAD framework only works if agents actually use it. This skill exists because a previous session shipped 20+ features without running snapshot, without updating the task registry, and without invoking any of the 25+ existing skills. That is exactly the failure mode the framework is supposed to prevent.

## Why this skill is load-bearing

GAD's core research claim (gad-74) is that task management at scale + workflow discipline produces better outcomes than ad-hoc execution. If agents working IN the repo don't follow the discipline, we cannot test the claim. Session 2026-04-09 is the first documented instance of an agent drifting into ad-hoc mode while building the very framework that tests discipline. Do not repeat it.

## When to load this skill

- **Session start.** Before any tool call that writes to the repo.
- **Resume after auto-compact.** Snapshot alone is not enough — you also need to reload this skill's discipline rules.
- **After the user gives new instructions.** Every new directive is a new turn; re-run the checklist.
- **When you notice you are pattern-matching the work instead of following a workflow.** Self-check: "did I run snapshot? did I check for a matching skill? did I update TASK-REGISTRY.xml?" If the answer to any of those is no, stop and run this skill.

## Hard-start checklist

Run these **in order** before executing any user request that touches the repo:

### Step 1 — Snapshot

```sh
gad snapshot --projectid <project-id>
```

Common project IDs: `get-anything-done` (the framework), `global`, `grime-time-site`, `repub-builder`. If the user didn't name a project, use `get-anything-done` for framework work and ask for anything else.

Read the output. Pay attention to:
- `current-phase` and `milestone` — what phase you should be working in
- `next-action` — the previous session's handoff
- `recent decisions` — is anything relevant to the current ask?
- `recent commits` — what's already done that the user might think is still open?

### Step 2 — Check TASK-REGISTRY.xml for a matching planned task

```sh
gad tasks --projectid <project-id>
```

Scan the `planned` tasks for anything whose goal matches the user's request. If you find one:
- **Adopt it.** Don't create a new task. Mark it `in-progress`.
- Read its goal text, its dependencies, its keywords.

If nothing matches:
- Create a new task in `.planning/TASK-REGISTRY.xml` with a new id (`<phase>-<next-number>`), status `in-progress`, and a goal line that matches the user's request.

**Do NOT** use Claude Code's session-scoped TaskCreate tool for GAD work. That tool is ephemeral and its tasks vanish when the session ends. GAD work must flow through `.planning/TASK-REGISTRY.xml` so it persists.

### Step 3 — Scan for relevant skills

```sh
ls skills/
```

For the kind of work about to happen, skim the skill names. If any match, open its SKILL.md and read the "When to use" section:

| You're about to... | Load this skill first |
|---|---|
| Regenerate site data / rebuild site | `portfolio-sync` |
| Add a new eval project or run | `eval-run`, `eval-bootstrap` |
| Explore an unfamiliar part of the repo | `map-codebase` |
| Write documentation for a feature | `write-feature-doc` |
| Plan a phase before implementing | `plan-phase` |
| Verify a phase is actually done | `verify-phase` |
| Start a new project | `new-project` |
| Design an eval rubric | `objective-eval-design` |
| Upgrade the framework itself | `framework-upgrade` |
| Capture a non-obvious pattern you just learned | `create-skill` |

If no existing skill matches AND the work is non-obvious or repeatable, **author a new skill** using `create-skill` BEFORE finishing the work — not at the end.

### Step 4 — Check the active phase in ROADMAP.xml

```sh
gad phases --projectid <project-id>
```

Is there a phase that covers this work? If yes, use its id in task + commit references. If no, decide whether a new phase is justified before creating it (new phases are substantial — do not spin one up for routine site work).

## During the work

### Write skills as you discover patterns

Every time you invent a non-obvious component, parser, or workflow in the course of the work, STOP before moving on and author a skill for it. Examples of patterns that should have been skills during session 2026-04-09 but weren't:

- The `Term` component pattern (glossary tooltip via native `<abbr title>` + `Link`)
- The `Ref` component pattern (structured ID → anchor URL with per-kind color tint)
- The `data/` JSON pseudo-database pattern (hand-curated content → prebuild parse → typed TS export)
- The `SkillCopyActions` client component pattern (Copy SKILL.md + Copy frontmatter with 1.5s feedback)
- The per-round pressure progression bar pattern on `/roadmap`

Each of those took 10-20 minutes to invent and will be reinvented by future sessions if they aren't captured.

**Rule of thumb:** if you are about to do the same kind of thing you did 20 minutes ago with a slight variation, you missed a skill opportunity. Go back and write it.

### Update TASK-REGISTRY.xml as work completes

When you finish a task, edit `.planning/TASK-REGISTRY.xml` directly:
- Change `status="in-progress"` to `status="done"`
- Optionally add the commit sha in a `<commit>` child element

Do this as you finish each task, not in a batch at the end.

## End of turn

### Step 1 — Update STATE.xml's next-action

Edit `.planning/STATE.xml` and replace the `<next-action>` text with what the next agent session should pick up. Be specific. Name the task ids that are now open.

### Step 2 — Capture new decisions

Any decision you made that future you needs to remember goes in `.planning/DECISIONS.xml` as a new `<decision>` element with a stable `gad-NN` id. Title + summary + impact.

### Step 3 — Commit with a task id

```sh
git add <files>
git commit -m "NN-NN: <what changed>"
```

OR if the work is routine site sync:

```sh
git commit -m "chore(site): regenerate data after <what changed>"
```

OR if you shipped a clear feature:

```sh
git commit -m "portfolio-sync: <NN-NN> <what shipped>"
```

**Do not** commit with vague prefixes like "batch 2" or "refactor" unless the commit body references task ids.

### Step 4 — Push

```sh
git push
```

If this is a submodule inside a parent repo (common case for the site), also bump the submodule pointer in the parent:

```sh
cd <parent-repo>
git add <submodule-path>
git commit -m "chore: bump <submodule> — <summary>"
git push
```

## Self-check questions to run before declaring a turn done

If you answer "no" to any of these, you skipped a step:

1. Did I run `gad snapshot` at the start of this turn?
2. Did I check TASK-REGISTRY.xml for a matching planned task?
3. Did I load a relevant skill before starting the work (or author one if none existed)?
4. Did I update TASK-REGISTRY.xml with the task(s) I completed?
5. Did I update STATE.xml's next-action?
6. Did I capture new decisions in DECISIONS.xml?
7. Did I commit with a task id or chore prefix?
8. Did I author skills for any non-obvious patterns I invented?

**If any answer is no:** the turn is not done, even if the code is committed.

## What this skill does not do

- It does not enforce anything automatically. Discipline is on the agent.
- It does not replace `portfolio-sync`, `create-skill`, or any other specific-workflow skill. Those fire after this one.
- It does not cover the GAD loop for complex multi-phase work — that belongs to `plan-phase` + `execute-phase` + `verify-phase`.

This skill is the entry gate. Load it first, then branch into whichever domain-specific skill the work needs.

## Failure mode this skill is designed to prevent

Session 2026-04-09: an agent shipped 20+ features across multiple turns, using Claude Code's session-scoped TaskCreate tool instead of TASK-REGISTRY.xml. Zero skills invoked. No `portfolio-sync` calls despite doing exactly portfolio sync work. Planned tasks in the registry (22-20, 22-21, 22-23, 22-24, 22-25, 22-31) were never adopted — the work was done, but the registry still said they were planned. See `.planning/SESSION-REFLECTION-2026-04-09.md` for the full writeup.

That session had talented work output and zero framework discipline. This skill exists so the next session does not repeat that pattern.
