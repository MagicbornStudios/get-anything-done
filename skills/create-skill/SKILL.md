---
name: create-skill
description: >-
  Capture a reusable pattern, recipe, or failure-mode fix as a skill document so future
  agents (including you after a context reset) can apply it without rediscovering it. Use
  this skill whenever you solve a non-obvious problem, discover a working pattern after
  two or more failed attempts, hit a bug whose fix isn't self-evident from the code, or
  finish a piece of work that future runs will likely repeat. Write the skill the moment
  you learn the lesson — not at the end. In bare/emergent eval conditions this is the
  primary mechanism for agent-authored methodology. The agent IS the workflow author, and
  skills are how that authorship persists.
lane: meta
type: meta-framework
---

# create-skill

A skill is a short, concrete methodology document. It captures "when you hit X, do Y, because Z." Skills are the durable memory of an agent that has no other planning framework — write them as soon as you learn something worth keeping, not at the end of a session.

## When to write a skill

Write a skill when ANY of these are true:

- You solved a problem that took more than one attempt.
- You found a pattern that worked where a more obvious one did not.
- You hit a bug whose fix is not self-evident from reading the fixed code.
- You made a design decision that a later agent could reasonably question.
- You built a reusable primitive (scene transition, state composition, loader, etc.).

Do NOT write a skill for:

- Things any agent would already know (e.g. "use const not var").
- One-off fixes specific to a single file that nobody will touch again.
- Speculation about patterns you haven't actually used.

## The quality bar — skills are compartmentalized systems, not stored answers

**A skill that works is a small system with a tight requirements contract and
a reusable UX pattern.** The best proto-skill in the framework today is
`gad-visual-context-system` (VCS). Read it — that's the shape.

VCS's requirements contract, compressed to one table:

| Requirement | Applies where |
|---|---|
| Every interactive element has a searchable, deterministic id (`cid`) | In any UI surface the skill is installed into |
| A dev-only gate hides the identity overlay from production users | Same |
| Every modal ships a CRUD-round-trip footer against a real cid | Same |
| Performance cost is zero when the dev surface is disabled | Same |

Four requirements. Each one is checkable by a reader on the target surface.
The skill does not prescribe React vs Vue, or canvas vs DOM — it prescribes
the identity + discoverability contract, and any host system that satisfies
it gets the benefit (the agent can now act on "the thing I'm pointing at").

Call this pattern **compartmentalized-system-as-skill**:

1. **Small requirements set** — 3-6 items, each falsifiable on the host
   system. If you can't write a grep or a visual check that says "yes this
   host satisfies the contract", the requirement is too vague.
2. **UX or behavior pattern the skill wants to instantiate** — what
   changes for the operator/agent/user when the contract is satisfied.
   VCS's: "point at the thing, name the thing, let an agent address it."
3. **Host-agnostic** — the skill is the virus, the codebase is the host.
   VCS works in a Next.js app or a Phaser game or a Three.js scene, because
   the requirements are identity + dev gate + footer, not "use this React
   component." A 3D-space variant of VCS is viable *because* the contract
   is cell-level, not transport-level. A TUI variant is viable for the
   same reason.
4. **Self-contained rollout** — the skill names its own install steps. No
   "first go ship phase X". If the skill's preconditions aren't met, list
   them; don't make the reader guess.

Skills that don't meet this bar are still useful as **captured answers**
(how to fix a specific bug, how to configure a specific tool). Those belong
in the `dev` lane and look like the bulk of `skills/gad-*`. But when a skill
*can* be written as a compartmentalized system, prefer that shape — it
travels further and resists rot.

## Proto-skill signal check

Before promoting a proto-skill from `.planning/proto-skills/<slug>/` to
`skills/<slug>/` via `gad skill promote`, ask:

1. Does the skill name a small set of host-agnostic requirements?
2. Does it name the UX or behavior pattern it instantiates on the host?
3. Can I imagine running this skill against a stack other than the one it
   was born in (browser → TUI, web → game engine, etc.) and the requirements
   still make sense?
4. Did the skill already produce observable value in at least one host?

All four yes → promote. Two or fewer → keep as a captured-answer skill and
don't try to universalize. Somewhere in between → rewrite the requirements
section until it's either clearly universalizable or clearly not, then
re-ask.

See `skills/gad-visual-context-system/SKILL.md` + `VALIDATION.md` for the
canonical shape.

## Where skills live

```
game/.planning/skills/<kebab-name>.md
```

One skill per file. Kebab-case filename matching the skill's topic.

## Trace marker contract (for evals)

When running inside an eval with GAD trace hooks installed (`gad install hooks`),
**any skill you author should write its id to the trace marker file at start and
clear it at end.** This is how the hook handler attributes subsequent tool calls
to the active skill and emits a discrete `skill_invocation` event on each
transition.

```sh
# At the start of the skill
echo "my-skill-id" > .planning/.trace-active-skill

# ... skill body runs, tool calls get attributed ...

# At the end of the skill (or before handing control back)
echo -n "" > .planning/.trace-active-skill
```

Nested skills: when skill X invokes skill Y, Y overwrites the marker with its
own id. The hook handler records `parent: "X"` on the `skill_invocation` event
for Y, then when Y finishes and restores the marker to "X", another transition
event is emitted. The lineage is preserved as a chain of parent pointers.

**The agent never reads the marker directly.** The hook is the source of truth
for the event stream. The marker is a one-file write per skill start, zero
ceremony beyond that. No other coordination required.

Not running inside an eval? The marker file is harmless — it's just an
untracked file in `.planning/` that nothing reads. Write to it freely; it's
only consumed by `gad-trace-hook.cjs` when hooks are installed.

## YAML frontmatter format (critical)

Every skill starts with a YAML frontmatter block (`---` delimiters) containing `name` and
`description` fields. The skill loader in Claude Code, Cursor, Codex, and other runtimes
all parse this strictly with js-yaml, which means:

- **Descriptions with embedded colons break parsing.** A description like
  `"methodology: the core idea"` fails because YAML reads `methodology:` as a key.
- **Always use the folded block scalar form** (`>-`) for descriptions, which lets you
  write multi-line prose without worrying about colons, quotes, or line length:

  ```yaml
  ---
  name: my-skill
  description: >-
    First paragraph of the description, as long as you want. The folded scalar joins
    wrapped lines with spaces so the final string is a single paragraph. Colons inside
    the prose are safe: they don't get parsed as YAML keys because the scalar is treated
    as a single opaque string.
  ---
  ```

- The `>-` is `>` (folded, lines join with spaces) plus `-` (strip trailing newline).
  Without the `-`, you get an extra newline at the end; without the `>`, you get literal
  line breaks preserved.
- Indentation matters. The body of the folded scalar must be indented more than the
  `description:` key. Two spaces is the convention.

**Test your skill frontmatter** before shipping by running any YAML parser:

```sh
node -e "console.log(require('js-yaml').load(require('fs').readFileSync('SKILL.md','utf8').split('---')[1]))"
```

Or just let `install.js` do it — it validates every SKILL.md during install and warns on
the exact line and column of any failure (this is how we caught the two broken skills in
session 6).

## Skill structure

Every skill follows the same shape. Keep it short — a skill longer than one screen is usually two skills.

```markdown
# <Skill name — imperative or noun phrase>

## When to use
<1-3 bullets describing the trigger — what situation makes this skill relevant>

## The pattern
<The concrete recipe. Code snippet preferred over prose. Show the working shape.>

## Why
<One paragraph. The reason this works, or the reason the obvious alternative fails.
 If this skill exists because of a specific past failure, describe the failure.>

## Failure modes
<Bullets. What goes wrong if you do this slightly wrong. How to recognize it.>

## Related
<Other skills this depends on or supersedes, if any.>
```

## Writing rules

1. **Lead with the trigger.** A skill nobody reads because they don't know when it applies is dead. The "When to use" section must let a future agent decide in 5 seconds whether to keep reading.
2. **Show working code, not pseudocode.** Paste the shape that actually worked. An agent reading the skill should be able to adapt the snippet directly.
3. **Explain the failure you avoided.** "Why" is the most load-bearing section. Without it, future agents cannot judge edge cases — they'll either blindly follow or blindly ignore.
4. **Write it immediately.** If you defer skill-writing to "the end of the phase," you will forget the details that matter (the specific error message, the alternative you tried first, why it failed). Write the skill in the same commit that contains the fix.
5. **Update, don't duplicate.** Before creating a new skill, check existing `.planning/skills/` for one covering the same ground. Update and sharpen the existing skill instead of adding a near-duplicate.
6. **Delete wrong skills.** If a skill turns out to encode a bad pattern, delete or rewrite it. A stale skill is worse than no skill — it actively misleads.

## Emergent condition: inheritance and evolution

If you are running in the `emergent` eval condition, you inherit skills from the previous run under `game/.planning/skills/`. Your job is to:

1. Read every inherited skill before writing code.
2. Apply the ones that match your situation.
3. When an inherited skill is wrong or incomplete, REWRITE it in place. Keep the filename so the skill's lineage is trackable.
4. Write a `CHANGELOG.md` in `game/.planning/skills/` summarizing what you changed from the inherited set and why. This is how the next run learns.

## Bare condition: you start with nothing

If you are running in the `bare` eval condition, you start with only this skill. Everything else is yours to author. The expectation is not that you build a clone of the GAD framework — it's that you write down whatever working methodology emerges, so that you can pick it up again after a context reset and so that future emergent runs can inherit it.

## Confirm capture

After writing a skill, log the capture in your working notes (wherever you're tracking progress):

```
Skill captured: <name>
Trigger: <one-line trigger>
File: game/.planning/skills/<name>.md
```

Then continue with the work that prompted the skill. Skill capture should take under two minutes — if it takes longer, you are probably writing a design doc, not a skill.
