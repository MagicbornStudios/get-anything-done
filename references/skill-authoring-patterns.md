# Skill authoring patterns

Companion to `references/skill-shape.md`. Covers quality bar, eval-condition
behaviors, and trace infrastructure for skill authors.

## Compartmentalized-system-as-skill

The highest-value skill shape. A skill that works is a small system with a
tight requirements contract and a reusable UX pattern. The canonical example
is `gad-visual-context-system` (VCS).

VCS requirements contract (compressed):

| Requirement | Applies where |
|---|---|
| Every interactive element has a searchable, deterministic id (`cid`) | Any UI surface the skill is installed into |
| A dev-only gate hides the identity overlay from production users | Same |
| Every modal ships a CRUD-round-trip footer against a real cid | Same |
| Performance cost is zero when the dev surface is disabled | Same |

Four requirements. Each checkable by grep or visual inspection. The skill
does not prescribe React vs Vue, or canvas vs DOM — it prescribes the
identity + discoverability contract. Any host that satisfies it gets the
benefit.

Four properties that define this shape:

1. **Small requirements set** — 3-6 items, each falsifiable on the host
   system. If you can't write a grep or a visual check that says "yes this
   host satisfies the contract", the requirement is too vague.
2. **UX or behavior pattern the skill instantiates** — what changes for the
   operator/agent/user when the contract is satisfied. VCS's: "point at the
   thing, name the thing, let an agent address it."
3. **Host-agnostic** — the skill is the virus, the codebase is the host.
   A 3D-space variant of VCS is viable because the contract is cell-level,
   not transport-level.
4. **Self-contained rollout** — the skill names its own install steps. No
   "first go ship phase X". If preconditions aren't met, list them.

Skills that don't meet this bar are still useful as **captured answers**
(how to fix a specific bug, how to configure a specific tool). Those belong
in the `dev` lane. But when a skill *can* be written as a compartmentalized
system, prefer that shape — it travels further and resists rot.

## Proto-skill promotion checklist

Before promoting a proto-skill from `.planning/proto-skills/<slug>/` to
`skills/<slug>/` via `gad skill promote`, ask:

1. Does the skill name a small set of host-agnostic requirements?
2. Does it name the UX or behavior pattern it instantiates on the host?
3. Can I run this skill against a different stack (browser → TUI, web →
   game engine) and have the requirements still make sense?
4. Did the skill already produce observable value in at least one host?

All four yes → promote. Two or fewer → keep as captured-answer skill. In
between → rewrite the requirements section until clearly universalizable or
clearly not, then re-ask.

Canonical shape reference: `skills/gad-visual-context-system/SKILL.md` +
`VALIDATION.md`.

## Trace marker contract (for evals)

When running inside an eval with GAD trace hooks installed (`gad install hooks`),
write the skill id to the trace marker at start and clear it at end:

```sh
# Start of skill
echo "my-skill-id" > .planning/.trace-active-skill

# End of skill (or before handing control back)
echo -n "" > .planning/.trace-active-skill
```

Nested skills: when skill X invokes skill Y, Y overwrites the marker. The
hook records `parent: "X"` on the `skill_invocation` event for Y, then when
Y finishes and restores the marker to "X", another transition event is
emitted. Lineage is preserved as a chain of parent pointers.

The agent never reads the marker directly — the hook is the source of truth.
The marker is a one-file write per skill start. Not running inside an eval?
The marker file is harmless — write to it freely; `gad-trace-hook.cjs`
only consumes it when hooks are installed.

## Eval conditions (bare / emergent)

### Emergent condition

You inherit skills from the previous run under `game/.planning/skills/`. Your job:

1. Read every inherited skill before writing code.
2. Apply the ones that match your situation.
3. When an inherited skill is wrong or incomplete, REWRITE it in place.
   Keep the filename so the skill's lineage is trackable.
4. Write a `CHANGELOG.md` in `game/.planning/skills/` summarizing what
   you changed and why. This is how the next run learns.

### Bare condition

You start with only the `create-skill` skill. Everything else is yours to
author. The expectation is not that you build a clone of GAD — it's that
you write down whatever working methodology emerges, so you can pick it up
after a context reset and future emergent runs can inherit it.
