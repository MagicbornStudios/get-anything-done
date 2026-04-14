# Sink MD → XML Conversion Audit (task 42.4-10)

## 1. Question

Does any existing `gad` command convert human-authored markdown planning prose
(`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`) into the canonical
XML planning files (`STATE.xml`, `ROADMAP.xml`, `REQUIREMENTS.xml`,
`TASK-REGISTRY.xml`, `DECISIONS.xml`) that the rest of the framework reads?
Short answer: **no**. The sink surface is MD/XML-tolerant on the way *out* to
MDX, XML-only on the way *in* from MDX, and nothing in the tree parses MD
prose into the canonical XML shape. Details below.

## 2. Command surface audited

Read directly from `bin/gad.cjs` and `lib/docs-compiler.cjs` (not help text).

- **`gad docs compile`** (`bin/gad.cjs:1650`) — iterates configured roots, calls
  the same `compileDocs` path as `gad sink compile` under the hood. Planning
  root → MDX in `docs_sink`. One-way, source → sink.
- **`gad docs list`** (`bin/gad.cjs:1709`) — read-only enumeration of planning
  files, DOCS-MAP entries, and sink feature-docs. Does not transform.
- **`gad sink status`** (`bin/gad.cjs:7052`) — stat-based comparison between
  each `SINK_SOURCE_MAP` entry in `.planning/` and the compiled MDX. Reports
  `missing | stale | human-authored | ok`. No writes.
- **`gad sink diff`** (`bin/gad.cjs:7094`) — calls `diffSink()` in
  `lib/docs-compiler.cjs`, produces a unified diff between what `compile`
  *would* write and what's on disk in the sink. No writes.
- **`gad sink compile`** (`bin/gad.cjs:7132`) — delegates to
  `lib/docs-compiler.cjs:compile()`. For each `SOURCE_MAP` row it picks the
  first existing file among `[STATE.xml, STATE.md]`, etc. If the hit is `.xml`
  it runs `xmlToMdBody()` (dedicated per-file converters: `stateXmlToMd`,
  `roadmapXmlToMd`, `decisionsXmlToMd`, `taskRegistryXmlToMd`,
  `requirementsXmlToMd`, `errorsXmlToMd`, `blockersXmlToMd`). If the hit is
  `.md` it just calls `stripFrontmatter()` and emits the body verbatim wrapped
  in MDX frontmatter. **Nothing parses the MD into XML.**
- **`gad sink sync`** (`bin/gad.cjs:7160`) — identical to `sink compile` but
  defaults to all roots. Same code path.
- **`gad sink decompile`** (`bin/gad.cjs:7188` → `lib/docs-compiler.cjs:97`) —
  despite the suggestive name, this is a **stub creator**, not a reverser.
  Iterates `SOURCE_MAP`; if the corresponding MDX exists in the sink but no
  source file exists in `.planning/`, it writes an **empty XML shell** of the
  form `<?xml ... ?>\n<state>\n  <!-- Stub created... -->\n</state>\n`. It
  never reads MDX content. It never reads MD content. If any source file
  (XML or MD) already exists, it skips — "XML is authoritative, do not
  overwrite."
- **`gad sink validate`** (`bin/gad.cjs:7215`) — dir-existence check; errors if
  `.planning/` missing, warns if sink dir not compiled yet. Purely structural.
- **`gad migrate-schema`** (`bin/gad.cjs:6794`) — goes the **wrong direction**
  for our purposes: XML → MD. Given a `.planning/` dir with XMLs, it runs
  `convertXmlToMd()` (another regex-based shredder) and archives the XMLs
  under `archive/xml/`. Billed as "Convert RP XML planning files to GAD
  Markdown." Not a candidate for MD → XML.

## 3. Flow diagram

```
                 source of truth                    compiled view
.planning/<id>/          ──── sink compile ────►    docs_sink/<id>/planning/
  STATE.xml (preferred)                                state.mdx
  STATE.md   (fallback)  ── stripFrontmatter ─►        (MDX wrapper, MD body)
  ROADMAP.xml            ── roadmapXmlToMd  ─►         roadmap.mdx
  ROADMAP.md             ── stripFrontmatter ─►        ...
  ...                                                  ...

docs_sink/<id>/planning/  ──── sink decompile ───►  .planning/<id>/
  state.mdx                                           STATE.xml  <-- EMPTY STUB
  (only triggers if no                                             no content
   source file exists)                                              transferred
```

Key points:
- `compile()` reads `.xml` OR `.md`. XML goes through structured per-file
  converters; MD is pasted through.
- `decompile()` is one-way structure-only: sink exists + source missing →
  empty XML shell. It is named decompile but it does not decompile anything.
- No path anywhere reads MD content and writes XML content.

## 4. Test case

Built a minimal markdown-only planning root in `/tmp/gad-md-test` and exercised
every plausible command. Actual command output:

```
$ ls myproj/.planning/
ROADMAP.md  STATE.md

$ gad sink status --projectid myproj
PROJECT  SRC         SINK                         STATUS
myproj   STATE.md    myproj/planning/state.mdx    missing
myproj   ROADMAP.md  myproj/planning/roadmap.mdx  missing

$ gad sink compile --projectid myproj
  ✓ myproj: 2 file(s)
✓ Sink compile: 2 file(s) written to docs_sink

# sink compile happily produced MDX but .planning/ still has NO xml:
$ ls myproj/.planning/
ROADMAP.md  STATE.md

# docs_sink/myproj/planning/state.mdx contains the original MD body verbatim
# wrapped in MDX frontmatter. No XML parsing happened.

$ gad sink decompile --projectid myproj
  ✓ myproj: 2 stub(s) created in .../myproj/.planning
✓ Decompile: 2 stub file(s) created.

$ ls myproj/.planning/
ROADMAP.md  ROADMAP.xml  STATE.md  STATE.xml
# NEW xml files — but they're empty <state></state> / <roadmap></roadmap>
# shells. The MD prose was NOT transferred into them.

$ gad migrate-schema --path myproj/.planning --yes
  ROADMAP.xml  →  ROADMAP.md       (XML→MD, wrong direction)
  STATE.xml    →  STATE.md
  ⚠ ROADMAP.md already exists — created ROADMAP-migrated.md
  ⚠ STATE.md   already exists — created STATE-migrated.md
✓ Migration complete — 0 files created, 2 archived
# This trashed the stub XMLs we just made. Wrong tool for the job.
```

**Result: zero commands transferred MD prose into canonical XML.**
`sink compile` wraps MD as MDX (passes content through but does not structure
it). `sink decompile` creates empty XML shells and ignores sibling MD.
`migrate-schema` moves XML to MD, not the reverse.

## 5. Determination: **(C) — no existing command handles it**

Nothing in the current surface parses markdown planning prose into the
canonical XML shape that the readers (`readState`, `readPhases`, `readTasks`,
`readDecisions`, `readRequirements`) depend on. `sink decompile` is closest in
*name* but functionally miles away — it creates empty shells and explicitly
refuses to read sink content ("XML is authoritative, do not overwrite" is the
inverse of what MD→XML needs). `sink compile` handles MD input but only as a
pass-through into MDX, not as a structured transform into canonical XML. The
surface is **internally consistent** (XML is the source of truth; MD is a
tolerated fallback; MDX is a one-way dist target) — it just has no story for
markdown-prose-as-input. The gap is real, and extending `decompile` would
conflict with its documented invariant ("never overwrites existing source
files") because the useful case is exactly when an MD source already exists
and we want to replace or shadow it with XML. A focused subcommand is
cleaner than overloading `decompile`.

## 6. Follow-up spec (future task)

New subcommand: **`gad planning hydrate`** (or `gad sink hydrate` if we want
it under the sink namespace — I lean toward `planning` since input is
`.planning/`, not the sink). Spec:

```
gad planning hydrate [--projectid <id>] [--all] [--dry-run] [--force]
```

Behavior:
- For each resolved root, walk `.planning/` for the canonical set
  `{STATE, ROADMAP, REQUIREMENTS, DECISIONS, TASK-REGISTRY}`.
- For each slot where `FOO.md` exists and `FOO.xml` does NOT (or `--force`
  supplied), parse the MD body into the canonical XML shape:
  - `STATE.md`: extract `Phase:`, `Milestone:`, `Status:` labeled lines +
    everything after a `Next:` / `## Next action` heading → `<current-phase>`,
    `<milestone>`, `<status>`, `<next-action>`. Mirror `stateXmlToMd` in
    reverse.
  - `ROADMAP.md`: parse `- [x|  ] **Phase NN:** goal` bullets → `<phase
    id="NN" status="done|planned"><goal>...</goal></phase>`. Mirror
    `roadmapXmlToMd` in reverse.
  - `REQUIREMENTS.md`, `DECISIONS.md`, `TASK-REGISTRY.md`: symmetrical, each
    matching its `*XmlToMd` counterpart in `lib/docs-compiler.cjs`.
- `--dry-run`: print the generated XML to stdout, don't write.
- Without `--force`: skip if `FOO.xml` exists.
- With `--force`: archive the existing XML under
  `.planning/archive/xml/<ts>/` then write the new one.
- Leaves the `FOO.md` in place (it stays as a human-readable shadow; the
  compile path will continue to prefer the XML).

Implementation location: new `hydrateFromMd()` in
`lib/docs-compiler.cjs` — reuses the same `SOURCE_MAP` the existing
compile/decompile functions use, and each per-file parser is the inverse of an
existing `*XmlToMd()` function living right next to it. Budget: ~120 LOC in
`lib/docs-compiler.cjs` + ~30 LOC CLI wrapper in `bin/gad.cjs`. Over the 50
LOC "extend decompile" budget the task goal floated — which is further
evidence this should be a new subcommand, not an extension. Do **not**
implement in 42.4-10; this is a spec for a future focused task.

Open design question for the follow-up:
- Do we want hydrate to be bidirectional-safe (i.e. after hydrate, can you
  `migrate-schema` back without loss)? Only relevant if the MD is
  round-trippable.
- Does `gad projects init` (42.4-08) want to call hydrate as a final step so
  markdown scaffolding users can get XML for free? Probably yes.

## 7. Related tasks

- **42.4-08** (`gad projects init`) — will benefit from hydrate when a user
  scaffolds a new project from MD templates. Not blocking, can wait.
- **42.4-09** (canonical project shape audit) — parallel; establishes which
  files *must* exist. Hydrate produces exactly that set.
- **42.4-11** (sink-pipeline coherence doc) — will cite this audit as the
  reference for "what MD→XML gap exists" and reference the hydrate spec as
  the planned fix. This doc stays narrow on the conversion gap; 42.4-11 owns
  the full pipeline map.

## Surprises from the audit

1. `sink decompile` is misnamed. It does not decompile. It creates empty
   shells. If a new developer read the help text they would expect it to read
   MDX and emit XML — it does neither. Worth a rename or a doc fix regardless
   of whether hydrate ships. (Not in scope for this task, flag for 42.4-11.)
2. `sink compile` silently accepts MD input and degrades to pass-through.
   There's no warning that "this MD file won't be queryable by `gad state` /
   `gad tasks` / etc." — the user just gets MDX in the sink and silence from
   the readers. A `gad health` warning (42.4-09's territory) for "MD present,
   XML missing" would be a cheap win.
3. `migrate-schema` archives XML after conversion. Running it against the
   decompile-generated empty stubs actively destroyed them (archived to
   `archive/xml/`). If anyone ever extends `decompile` to do real work, that
   interaction is a footgun.
