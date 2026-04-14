# Sink Pipeline — Coherence Map

> **Status:** normative. Pipeline map for the full `.planning/` → docs sink → site flow.
> **Last reviewed:** 2026-04-14 (task 42.4-11).
> **Companion docs:** `references/sink-md-xml-audit.md` (per-command behavior),
> `references/project-shape.md` (canonical file set).

## 1. Purpose

This doc is the **coherence map** for GAD's planning compilation pipeline. It
answers "which surface do I edit when?" at the granularity of a single command
per concrete task. It complements `sink-md-xml-audit.md` (which catalogs what
each `gad sink` / `gad docs` command *actually does*, including the broken
parts) and `project-shape.md` (which pins the canonical `.planning/` file set).
Intended reader: an agent who just ran `gad snapshot` and now needs to change
planning state without accidentally editing a derived artifact.

## 2. Source of truth

**XML files under `.planning/` are authoritative. Everything else is derived.**
MDX in `docs/<id>/planning/` is a compiled view for humans and the site. Static
sites under `dist/site/` (from `gad site compile`) are a further derived
surface. There is no supported reverse flow: `sink-md-xml-audit.md`
determination **(C)** establishes that no command parses MDX or MD prose back
into canonical XML — `sink decompile` only creates empty shells, and
`migrate-schema` goes the wrong direction (XML→MD). If you edit an MDX file
in the sink, the next `gad sink compile` overwrites it.

## 3. The three registries

All three live in `gad-config.toml` at the repo root.

| Registry | Declares | Consumed by |
|---|---|---|
| `[[planning.roots]]` | `.planning/` dirs across the monorepo (one per project) | `gad snapshot`, `gad state`, `gad tasks`, `gad phases`, `gad decisions`, `gad workspace show`, `gad projects audit` |
| `[[docs.projects]]` | Non-planning-root feature-doc projects (apps, platforms, lore) that compile into `docs_sink/<id>/` | `gad docs list`, `gad docs compile`, `gad sink compile` (iteration target) |
| `[[evals.roots]]` | Eval project roots (added 42.4-12) | `gad eval list/run/preserve/verify/open/review/report/suite` |

`[planning] docs_sink = "docs"` names the single output directory that the
sink compile path writes into. Every planning root compiles into
`<docs_sink>/<root-id>/planning/*.mdx`; every `[[docs.projects]]` entry
compiles into `<docs_sink>/<sinkPath>/` as free-form feature docs.

## 4. The flow

```
           AUTHORITATIVE                                 DERIVED
           ────────────                                 ────────
  .planning/<id>/*.xml  ── gad sink compile ─►  docs/<id>/planning/*.mdx
           │                                              │
           │                                              │
           │                                              └── consumed by site/
           │                                                  (Next.js portfolio)
           │
           └── gad site compile ─────────────────────►  dist/site/ (static bundle)
                   (reads .planning/ directly,
                    NOT the MDX sink)

  docs/<id>/planning/*.mdx  ── gad sink decompile ─►  .planning/<id>/*.xml
                                                         (EMPTY SHELLS ONLY —
                                                          name is misleading,
                                                          does not read MDX)
```

Arrows that actually work:
- `.planning/*.xml` → `docs/<id>/planning/*.mdx` via `gad sink compile`
  (structured per-file XML→MDX converters in `lib/docs-compiler.cjs`).
- `.planning/*.xml` → `dist/site/` via `gad site compile` (reads
  `.planning/` directly, independent axis from the sink).

Arrows that are broken or aspirational:
- `sink decompile` — never reads MDX content, only creates empty XML shells if
  a source file is missing.
- `sink compile` on markdown input — silently passes through to MDX without
  structuring, so the readers (`gad state`, `gad tasks`, etc.) can't query it.
- No MD→XML hydrate path exists (see `sink-md-xml-audit.md` §6 for the
  proposed `gad planning hydrate` follow-up).

## 5. Quick-reference table

| I want to… | Use command / action | Verify with |
|---|---|---|
| Edit a project's current phase or next-action | Hand-edit `.planning/STATE.xml` | `gad state --projectid <id>` |
| Edit a project's phase list | Hand-edit `.planning/ROADMAP.xml` | `gad phases --projectid <id>` |
| Add, update, or complete a task | Hand-edit `.planning/TASK-REGISTRY.xml` | `gad tasks --projectid <id>` |
| Record a new decision | Hand-edit `.planning/DECISIONS.xml` | `gad decisions --projectid <id>` |
| Add a new planning root | Edit `gad-config.toml` `[[planning.roots]]` | `gad workspace show` |
| Auto-discover planning roots across the monorepo | `gad workspace sync` | `gad workspace show` |
| Audit planning-root shape against `project-shape.md` | `gad projects audit` | re-run after fixes |
| Initialize a new planning root | `gad projects init` (XML-default per 42.4-08) | `gad projects audit` |
| Compile one project's planning XML → docs MDX | `gad sink compile --projectid <id>` | `gad sink status --projectid <id>` + `gad sink diff --projectid <id>` |
| Compile every planning root + every `[[docs.projects]]` entry | `gad docs compile` (or `gad sink sync`) | browse `docs/<id>/planning/` |
| See which MDX is stale vs `.planning/` source | `gad sink status` | — |
| See the exact diff the next compile would write | `gad sink diff` | — |
| Add a non-planning-root feature-doc project | Edit `gad-config.toml` `[[docs.projects]]` | `gad docs list` |
| Write a feature or tech doc under a `[[docs.projects]]` entry | `/gad:write-feature-doc` or `/gad:write-tech-doc` | `gad docs list` |
| Compile a single project's planning into a static site | `gad site compile --root <dir> --projectid <id>` | `gad site serve` (local preview) |
| Convert legacy MD planning docs (`STATE.md`, `ROADMAP.md`, …) into canonical XML | **NOT SUPPORTED** — see `sink-md-xml-audit.md` §6 for proposed `gad planning hydrate` | — |
| "Round-trip" MDX back into `.planning/` XML | **NOT SUPPORTED** — `sink decompile` only stubs empty shells, does not read MDX | — |
| Start a new project from scratch | `/gad:new-project` then `/gad:plan-phase 1` | `gad snapshot --projectid <id>` |
| Rebuild the portfolio site's planning views | `gad sink compile` then rebuild site | visit site `/planning/<id>` route |

Rows marked **NOT SUPPORTED** are real gaps, not missing knowledge — see §6.

## 6. Known footguns

From `sink-md-xml-audit.md` and direct grep of `bin/gad.cjs`:

- **`sink decompile` is misnamed.** Help text implies reverse compilation; it
  actually only creates empty XML shells when source is absent. It never reads
  MDX. Rename or doc-fix pending.
- **`sink compile` silently degrades on MD input.** If it finds `STATE.md`
  instead of `STATE.xml` it pass-throughs the body into MDX without warning
  that none of the readers (`gad state`, `gad tasks`, …) can query that
  content. A health warning is a cheap win (42.4-09 territory).
- **`migrate-schema` goes XML→MD and archives the XML.** Running it against a
  planning root that has decompile-generated stub XMLs actively destroys them.
  Wrong direction for almost every current use case.
- **`sink compile` and `site compile` read `.planning/` on separate axes.**
  The site does NOT consume the MDX sink — it reads XML directly. Editing MDX
  in the sink does not change what `gad site compile` produces.
- **No MD→XML path exists.** A markdown-authored planning root is a dead-end
  for the readers until a human hand-converts it. See `sink-md-xml-audit.md`
  §6 for the `gad planning hydrate` spec (not implemented).
- **`docs_sink` is singular.** There is exactly one sink path for the whole
  monorepo. Per-root override is not supported; every planning root compiles
  into the same tree keyed by root id.

## 7. Related docs

- `references/sink-md-xml-audit.md` — per-command behavior audit; the "why
  decompile doesn't decompile" reference. Source for §6 footguns.
- `references/project-shape.md` — canonical `.planning/` file set + per-file
  minimum valid XML headers. Contract for `gad projects init` and `gad
  projects audit`.
- `references/planning-config.md` — `gad-config.toml` schema reference.
- `.planning/workflows/gad-new-project.md` — full new-project flow that
  consumes this pipeline.

## 8. Change log

| Date | Task | Change |
|---|---|---|
| 2026-04-14 | 42.4-11 | Initial version. Pipeline map, three-registry table, quick-reference table (19 rows), footgun list, flow diagram. Cites 42.4-10's audit as dependency. |
