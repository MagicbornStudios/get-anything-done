---
name: create-skill
description: Capture a reusable pattern, recipe, or failure-mode fix as a skill document so future agents (including you after a context reset) can apply it without rediscovering it. Use this skill whenever you solve a non-obvious problem, discover a working pattern after two or more failed attempts, hit a bug whose fix isn't self-evident from the code, or finish a piece of work that future runs will likely repeat. Write the skill the moment you learn the lesson — not at the end. In bare/emergent eval conditions this is the primary mechanism for agent-authored methodology: the agent IS the workflow author, and skills are how that authorship persists.
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

## Where skills live

```
game/.planning/skills/<kebab-name>.md
```

One skill per file. Kebab-case filename matching the skill's topic.

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
