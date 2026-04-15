# gad-cross-config-domain-change

A **procedure for renaming a domain concept across a GAD monorepo without leaving
dangling references or breaking compiled sinks.** The value is not the `git mv` —
it is the *coordinated pass across every declared planning root and eval root* so
that the rename lands atomically from the operator's point of view.

The skill has **one entrypoint** and **two workflows**, chosen by the scope of
the rename.

## Core invariant (both workflows)

A domain-change is safe if and only if, after the operation:

1. Every occurrence of the old name in every planning root and eval root declared
   in `gad-config.toml` is either (a) rewritten to the new name, or (b) intentionally
   preserved as a shim/alias and **cited in a DECISIONS.xml translation-note entry**.
2. `grep` for the old name across the monorepo returns zero hits outside the
   translation-note shim and the decision log itself.
3. Compiled sinks (planning docs sink, site data, catalog generators) rebuild
   clean — no broken imports, no orphaned slugs, no case-insensitive FS collisions.
4. The operator can run `node vendor/get-anything-done/bin/gad.cjs snapshot --projectid <id>`
   on every affected planning root and get a valid state readout.

The invariant is **scope-independent.** Workflow A and Workflow B differ only in
how many roots participate; the safety contract is identical.

## Which workflow to run

Determine scope by reading the top-level configuration first. Assume the
operator's working directory is the monorepo root and `gad-config.toml` lives at
the root.

```sh
# From the monorepo root:
node vendor/get-anything-done/bin/gad.cjs projects audit 2>&1 | head -60
node vendor/get-anything-done/bin/gad.cjs workspace show 2>&1 | head -40

# Show every planning + eval root declared in gad-config.toml:
grep -nE '^\[\[planning\.roots\]\]|^\[\[evals\.roots\]\]|^id =|^path =' gad-config.toml
```

Then classify:

- **Term appears in 2+ planning roots OR 1+ eval roots OR the config file itself**
  → **Workflow A: Monorepo-wide rename**.
- **Term is confined to a single `.planning/` root and its compiled sink**
  → **Workflow B: Single-project rename**.
- **Term only appears in source code (no planning-doc or config references)**
  → this skill is the wrong tool; use a normal refactor skill.

When in doubt, start in Workflow A — the pre-flight audit will downgrade to
Workflow B cleanly if the monorepo footprint turns out to be empty.

---

## Pre-flight config audit (both workflows)

Before any file is moved or edited, produce a **config-status readout** and
show it to the operator for confirmation. The readout has four sections:

1. **Config source of truth** — confirm that `gad-config.toml` at the monorepo
   root exists and parses. Per decision gad-160, this is the only canonical
   config; no per-project config overrides.
2. **Planning roots in scope** — list every `[[planning.roots]]` entry whose
   `path` contains the old term in any of: the path itself, a file inside the
   `planningDir`, or the compiled sink target.
3. **Eval roots in scope** — same for `[[evals.roots]]`. Remember the default
   `vendor/get-anything-done/evals/` root is implicit and must be checked even
   if it is not declared in `gad-config.toml`.
4. **Grep census** — a raw count of hits for the old term in each root, broken
   down by file type (planning XML, markdown, source, config, JSON).

```sh
# Census template — replace OLD with the term being renamed:
OLD="evals"
for path in $(grep -E '^path =' gad-config.toml | sed 's/path = //;s/"//g'); do
  echo "-- $path --"
  grep -rn "$OLD" "$path" 2>/dev/null | wc -l
done
grep -rn "$OLD" gad-config.toml | wc -l
```

The readout is the **decision point**. Operator confirms or aborts. No moves
happen before this.

---

## Workflow A: Monorepo-wide rename

Use this when the term crosses project boundaries — the canonical example is
renaming `evals` → `species` (see worked example below), or collapsing
`workspace` / `worktree` / `workstream` into their distinct meanings per
decision gad-161.

### Steps

1. **Run the pre-flight audit** above. Capture the readout in a temp file —
   this becomes the attachment for the translation-note decision.

2. **Lock the tree.** Announce the rename to the operator and ask them to pause
   any concurrent work in affected roots. A cross-root rename is not safe to
   interleave with other edits.

3. **Rewrite `gad-config.toml` first.** The config is the contract every other
   step references. Update `[[planning.roots]]` paths, `[[evals.roots]]` paths,
   `sinkPath` fields, and any `id` fields that embed the old term. Do **not**
   move any files yet — only the config text changes.

4. **Walk the union of roots in dependency order.** For each root from step 3:
   - Rename the top-level directory (see Git-mv-through-temp pattern below).
   - Run the planning-doc migration pass (see Planning-doc migration below).
   - Rebuild the compiled sink and confirm it is clean.

5. **Rewrite cross-root references.** Any planning doc in one root that
   references another root's path needs to be updated. Typical offenders:
   `STATE.xml <references>` entries, `ROADMAP.xml` phase descriptions that cite
   file paths, `workflows/*.md` examples.

6. **Config re-audit.** Re-run the pre-flight census. Expected result: zero
   hits for the old term outside the translation-note shim.

7. **Write the translation-note decision** (template below) in **every**
   affected planning root's `DECISIONS.xml`. Same decision ID namespace, same
   text, one entry per root. Cross-reference them by date.

8. **Rebuild sinks.** Run the planning-doc compiler and any site-data build
   that consumes the renamed roots. Expect at least one broken import on first
   pass; fix it, rebuild, confirm green.

### Deliverables

- Updated `gad-config.toml` at the monorepo root.
- Renamed directories and their contents across all affected planning and eval roots.
- One translation-note decision per affected planning root.
- A green snapshot for every affected `projectid`.
- A clean census report attached to (or cited by) the decisions.

### Failure modes

- **Partial rename** — config updated but a planning root missed. The next
  snapshot will fail loudly; recover by re-running the audit and finishing the
  skipped root.
- **Case-insensitive FS collision** (Windows, macOS default) — renaming `Evals`
  → `evals` on an existing `evals` path silently clobbers or no-ops. Always use
  the git-mv-through-temp pattern below for case-only changes.
- **Dangling references in compiled sinks.** The sink is a build artifact, but
  old generated files can linger until the next compile. Delete the sink
  directory and rebuild from scratch after a cross-root rename.
- **Broken site data.** Site catalog generators (e.g. `site/scripts/build-site-data.mjs`)
  read slugs out of the renamed roots. If the site is in scope, re-run its
  build and fix the generator references before declaring done.
- **Decision-log drift.** Writing the translation-note in only one root and
  forgetting the rest — future operators reading from a different root will
  have no idea the rename happened. One root, one decision, every time.

---

## Workflow B: Single-project rename

Use this when the term is confined to one `.planning/` root and its sink —
e.g. renaming a phase's internal vocabulary inside `vendor/get-anything-done/.planning/`
without touching any other root. The common case is a project-local term that
was never exported to `gad-config.toml` or to cross-project planning docs.

### Steps

1. **Run the pre-flight audit**, scoped to the one root. Confirm the
   cross-root census comes back zero — if it does not, abort and switch to
   Workflow A.

2. **Rename inside the root.** Apply the planning-doc migration pass below.
   No top-level directory rename unless the root's own path is changing.

3. **Rebuild the compiled sink** for this root only. Confirm clean.

4. **Write the translation-note decision** in this root's `DECISIONS.xml`. A
   single-root rename still deserves a translation note — future self-audits
   will ask "when did this change?"

5. **Snapshot verify.** `gad snapshot --projectid <id>` must parse and show
   the renamed term in `STATE.xml`, `ROADMAP.xml`, and `TASK-REGISTRY.xml`.

### Deliverables

- Renamed entries inside one `.planning/` root.
- One translation-note decision in that root's `DECISIONS.xml`.
- A green snapshot for the affected `projectid`.

### Failure modes

- **Unexpected cross-root leakage.** The term turns out to appear in
  `gad-config.toml` or a sibling planning root after all. Abort Workflow B and
  restart in Workflow A.
- **Snapshot parser still seeing the old term.** Usually a CRLF-line, XML
  attribute, or stray trailing whitespace. Re-grep case-insensitively and in
  multiline mode.

---

## Git-mv-through-temp pattern

`git mv` on a case-only rename (`Evals` → `evals`) is a no-op on
case-insensitive filesystems (Windows, default macOS). Use a temp-name
round-trip:

```sh
OLD="Evals"
NEW="evals"
TMP="${NEW}__tmp_rename__"

git mv "$OLD" "$TMP"
git commit -m "chore: rename $OLD -> $TMP (step 1/2, case-only workaround)"
git mv "$TMP" "$NEW"
git commit -m "chore: rename $TMP -> $NEW (step 2/2)"
```

This is also the safe pattern for **collision-avoidance** when the target name
already exists as a sibling (e.g. merging two directories into a new canonical
one). Move each source to a unique temp name first, then merge into the
canonical target in a second commit.

Always split into two commits — a single squashed commit will not survive
round-tripping through a case-insensitive worktree on a collaborator's
machine.

## Planning-doc migration

Inside any affected planning root, rewrite these files in this order:

1. `STATE.xml` — `current-phase`, `next-action`, `<references>` entries.
2. `ROADMAP.xml` — phase descriptions, phase IDs if they embed the term.
3. `TASK-REGISTRY.xml` — task descriptions, task types, skill attributions.
4. `DECISIONS.xml` — old decision text stays verbatim (history is immutable);
   the translation-note is a **new** entry, not an edit of old ones.
5. `workflows/*.md`, `notes/*.md`, `phases/*/`, `plans/*/` — grep sweep.
6. `config.json` if present — project-local metadata.

Use the operator's normal editor for each file and verify each change with
`grep` before moving to the next. Do **not** run a bulk sed across the whole
`.planning/` tree — the 2026-04-14 visual-context rollout regression (character
substitution in page files) is the cautionary tale. One file at a time, reads
before and after, Edit tool with explicit old/new strings rather than regex.

## Translation-note decision template

Append this to every affected `DECISIONS.xml`:

```xml
<decision id="GAD-D-NNN" slug="translation-note-<OLDTERM>-to-<NEWTERM>" date="YYYY-MM-DD">
  <title><OLDTERM> was renamed to <NEWTERM> across <scope></title>
  <context>
    On YYYY-MM-DD, the term "<OLDTERM>" was renamed to "<NEWTERM>" across
    <scope: monorepo | this planning root>. The rename was executed by the
    gad-cross-config-domain-change skill under task <task-id>. Pre-flight
    census showed <N> hits across <M> roots; post-rename census returned zero.
  </context>
  <decision>
    All future work uses "<NEWTERM>". The old term "<OLDTERM>" is preserved only
    in (a) historical decision entries, and (b) the alias shim at
    <full/repo-relative/path/to/shim> for N months, after which it is removed.
  </decision>
  <consequences>
    Anyone reading a decision or archived artifact that still says "<OLDTERM>"
    should mentally substitute "<NEWTERM>". The snapshot, roadmap, and task
    registry no longer mention the old term. Cross-reference with sibling
    translation-note decisions in <list other affected roots> for the full
    monorepo picture.
  </consequences>
  <status>accepted</status>
</decision>
```

One decision per affected planning root. Cross-reference them by date in the
`<consequences>` block so a future reader landing on any one of them can
reconstruct the full rename.

---

## Example: renaming `evals` → `species`

This is the motivating case flagged in the phase-44 evolution notes: the term
"evals" conflates the *run artifact* (a specific attempt by an agent), the
*project definition* (the thing being attempted), and the *directory on disk*.
Per decision gad-184, the project/species inheritance contract wants "project"
and "species" as the primary terms, and "evals" as a legacy umbrella.

A full rename would touch:

- `gad-config.toml` — `[[evals.roots]]` entries and their `path` fields.
- `vendor/get-anything-done/evals/` — the default eval root directory and every
  project subdirectory.
- `vendor/get-anything-done/bin/gad.cjs` — the `eval` subcommand surface, which
  would become `species` with `eval` aliased via a deprecation shim.
- `vendor/get-anything-done/site/` — site catalog generators, route paths,
  component names that embed "eval".
- `vendor/get-anything-done/.planning/TASK-REGISTRY.xml` — every task tagged
  `type="eval"`.
- `vendor/get-anything-done/.planning/DECISIONS.xml` — decisions that use
  "eval" in their text stay verbatim (history is immutable); a new
  translation-note decision points at them.
- `vendor/get-anything-done/skills/eval-*/SKILL.md` — skill names and
  descriptions.

Walkthrough under Workflow A:

1. **Pre-flight audit.** Expect the census to return a large hit count —
   probably several hundred — spread across the framework planning root, the
   eval-root directory, the site, and the CLI. This is the moment to confirm
   with the operator that the rename is actually desired before any moves.

2. **Decide the shim shape.** Because the CLI surface `gad eval ...` is in
   user muscle memory, the translation note should promise an alias period
   (say, 3 releases) where `gad eval` forwards to `gad species` with a
   deprecation warning. The shim itself lives at
   `vendor/get-anything-done/bin/gad.cjs` as a small forwarding branch.

3. **Rewrite `gad-config.toml`.** Rename `[[evals.roots]]` →
   `[[species.roots]]`, update any `id` fields, save.

4. **Git-mv the directories** with the temp-name round-trip pattern.
   `vendor/get-anything-done/evals/` → `vendor/get-anything-done/species/`.

5. **Walk the planning root.** Apply the planning-doc migration pass to
   `vendor/get-anything-done/.planning/`. The big targets are
   `TASK-REGISTRY.xml` (`type="eval"` → `type="species"`) and any
   `ROADMAP.xml` phase description that mentions evals.

6. **Walk the site.** `vendor/get-anything-done/site/scripts/build-site-data.mjs`
   reads from the old path and emits a `WORKFLOWS`/`EVALS` export. Fix the
   reader, fix the export name, rebuild.

7. **Walk the CLI.** Rename the subcommand module, add the forwarding alias,
   update `gad help` text. This is the step most likely to produce a broken
   build — the CLI has cross-file imports.

8. **Re-audit.** Census should go to zero outside the shim and the decision
   log. Snapshot every affected `projectid` — at minimum `get-anything-done`
   and `global`.

9. **Translation-note decisions.** One entry in the framework's
   `DECISIONS.xml`, one in `global`'s if global references any renamed path,
   cross-referenced.

The same shape applies to any other vocabulary normalization (`workspace` vs
`worktree` vs `workstream` per gad-161, or any future term). The skill's job
is to make the coordinated walk mechanical, not to decide *whether* the rename
is worth doing — that is a decision for the operator.

---

## References

- `gad-config.toml` (monorepo root) — the single canonical config per decision
  gad-160. This file's `[[planning.roots]]` and `[[evals.roots]]` tables define
  the full scope the skill walks.
- `vendor/get-anything-done/bin/gad.cjs` — `projects audit`, `workspace show`,
  `snapshot`, and `eval list` subcommands used by the pre-flight audit and the
  post-rename verification.
- `vendor/get-anything-done/.planning/DECISIONS.xml` — decisions gad-160
  (single canonical config), gad-161 (`workspace` / `worktree` / `workstream`
  disambiguation), and gad-184 (project ⊇ species inheritance contract) are the
  motivating context for this skill.
- `vendor/get-anything-done/.planning/STATE.xml` — the file format the
  planning-doc migration pass walks in step 1 of the migration.
- `vendor/get-anything-done/.planning/TASK-REGISTRY.xml` — the `type=` attribute
  convention that any vocabulary rename has to follow.
- `vendor/get-anything-done/skills/gad-visual-context-system/SKILL.md` — the
  canonical two-workflow proto-skill this file's structure is modeled on.
- `vendor/get-anything-done/site/scripts/build-site-data.mjs` — the site's
  compiled-sink generator; any monorepo-wide rename that touches the site has
  to re-run this and fix broken slug references.
- `vendor/get-anything-done/references/proto-skills.md` — the proto-skill
  lifecycle (proto → promote) this file will travel through.

## Relationship to parent skill

This proto-skill has **no parent**. It supersedes and replaces the earlier
`phase-43-eval-vocabulary` draft, which was discarded because it baked in
submodule-specific paths like `apps/public/evals` and was scoped narrowly to a
one-time rename rather than the general cross-config-domain-change pattern.
On promotion, this skill should graduate to
`vendor/get-anything-done/skills/gad-cross-config-domain-change/SKILL.md` as a
first-class skill with no deprecated ancestor to archive.
