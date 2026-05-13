# consolidate-cli-and-routes — workflow

When a CLI surface and a public route map have grown organically, the
right time to consolidate is in one phase: rename CLI commands AND trim
the route map AND wire deprecation aliases AND fix the broken imports
that fall out. Phase 46 collapsed `gad workspace ...` → `gad projects ...`
plus trimmed nav from 20+ to 9 routes plus added /how-it-works as the
absorbing route in 11 tasks.

## When to use

- A CLI command family is being renamed (e.g. `workspace` → `projects`).
- A public route map has accreted dead routes that need to come out.
- An informational hierarchy is being collapsed (multiple
  glossary/formula/standards routes folding into one /how-it-works).

## When NOT to use

- For single-command renames (just edit and ship).
- For private CLI changes (no operator-facing names changing).
- For backend route additions (this skill is about deletion + alias).

## Steps

1. Inventory the CLI rename:
   - Old command family + every subcommand.
   - Every error message that mentions the old name.
   - Every doc page / help text that references the old name.
   - Every external script or eval suite that calls the old name.
2. Implement the rename via decision (gad-208 pattern):
   - New command family lands first.
   - Old command family becomes an alias that prints a deprecation notice
     to stderr and forwards to the new command.
   - Error messages migrate to the new name immediately.
3. Inventory the route map:
   - Current public route list (from the nav component).
   - Routes with no inbound traffic per analytics.
   - Routes whose content can collapse into a single canonical page.
4. Trim + collapse:
   - Delete dead route directories (and their tests).
   - Build the absorbing route (/how-it-works style) that consolidates
     the deleted content.
   - Update nav component to reflect the new route count.
5. Fix the fallout:
   - Build will fail on imports from deleted route directories. Audit
     and fix.
   - Site type-check + build must pass before merge.
   - VCS audit (cids on every new section).
6. Add a deprecation stub for moved/deleted routes (not just deleted
   ones — see `move-route-with-deprecation-stub` skill for details).
7. Submodule audit (per task 46-15): for every submodule, classify
   KEEP / INLINE / DROP based on:
   - Last commit upstream vs ours.
   - Production usage vs dead references.
   - Whether the submodule layer still earns its keep.
   Deliver `references/submodule-audit-<date>.md`. Follow up DROPs with
   `.gitmodules` cleanup.

## Guardrails

- Never delete a route in the same commit as renaming a CLI command —
  reviewers can't tell which broke if rollback is needed.
- Aliases are temporary scaffolding. Set a deprecation deadline (one
  release cycle is conventional) and follow through with deletion.
- `gad <old> --help` must still print something during the alias window,
  redirecting the user to the new name. Silent failure is hostile.
- Submodule DROPs require the human in the loop — don't auto-remove
  submodules that have any inbound reference.

## Failure modes

- **Old command alias forwards to a still-broken new command.** Land
  the new command + tests first; only then write the alias.
- **Nav still shows deleted routes.** The nav component caches its route
  list — confirm the new list is the one rendered.
- **Stranded test files** for deleted routes. CI will pass the deletion
  but tests will reference removed pages.
- **Submodule audit declares KEEP without justification.** "Looks like
  it's used" is not a justification — count actual references with
  `git grep`.

## Reference

- Decision gad-207 (route trim), gad-208 (workspace → projects),
  gad-209 (species-level planning), gad-210 (assets/ convention),
  gad-211 (SpriteAnimation), gad-264 (teachings reader).
- Phase 46 tasks 46-01..46-10, 46-15.
- `move-route-with-deprecation-stub` skill — sibling for the route-move
  half of this work.
