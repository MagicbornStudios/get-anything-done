# GAD CLI Specification

Canonical command spec. All implementation must follow this exactly. Do not deviate.

## Design rules
- Missing required arg → print relevant list + exact rerun command. Never block/prompt.
- All list commands: `--json` flag for machine output, table for human default
- Color coding: baseline evals shown in YELLOW, active in GREEN, missing/gap in RED/DIM
- Subcommand with no args → print inline data + subcommand list at bottom
- Every command that touches a project: `--projectid` scopes to one project

---

## gad eval (full target spec)

```
gad eval
  list                              # all eval projects + latest run score + gap flag
  status                            # all GAD projects, eval coverage, last run date
  runs   --project <name>           # all versioned runs for one project, with scores
  show   --project <name>
         --run <vN>
         --file <RUN.md|SCORE.md|COMPARISON.md>   # print file to stdout
  scores --project <name>           # side-by-side score table across all runs
  run    --project <name>           # run eval; if no --project, print list + rerun hint
         --baseline                 # use portfolio-bare requirements as control template
         --projectid <id>           # target GAD project for baseline run
  score  --project <name>           # compute SCORE.md; if no --project, print list
         --run <vN>
  diff   --project <name>           # diff two runs; if no --project, print list
         <v1> <v2>
  trace  --session <id>             # show trace for a session
         --compare <id1> <id2>      # compare two session traces side by side
  version                           # show current GAD methodology version + changelog
```

### Missing arg behavior (non-interactive)
- `gad eval run` (no --project) → print eval project list with scores, then: "Run: gad eval run --project <name>"
- `gad eval score` (no --project) → same
- `gad eval show` (no --run) → print run list for that project, then: "Run: gad eval show --project X --run <vN> --file RUN.md"
- `gad eval` (no subcommand) → print status table + subcommand list

### Baseline eval concept
`gad eval run --baseline --projectid <id>` creates a NEW isolated GAD project seeded
with portfolio-bare REQUIREMENTS.md. This is the CONTROL VARIABLE for GAD methodology.
- portfolio-bare = frozen baseline; never modified mid-eval
- Each GAD methodology version gets its own baseline run
- Baseline projects shown in YELLOW in all list outputs
- History of baseline runs is permanent — never deleted
- User runs preferred coding agent against it: "build this"

---

## gad trace (new command group)

```
gad trace
  list   --session <id>             # list all trace events for a session
         --projectid <id>           # all traces for a project
  show   --session <id>             # full trace: what was retrieved, how, when
  diff   --session <id1> <id2>      # compare: CLI workflow vs raw tool-call workflow
  report --session <id>             # structured report: files retrieved, tokens, gaps
```

### What trace captures
Every time an agent retrieves planning context (state, session, roadmap, task-registry,
any planning doc), record:
- timestamp
- retrieval method: CLI command OR raw tool call (Read/Bash/Grep)
- file/command used
- bytes + tokens retrieved
- information units obtained (U1–U10 from DEFINITIONS.md)

This answers: "Did they use the CLI? What did they get? What would CLI have given instead?"

---

## gad sink (new command group)

```
gad sink
  status                            # all projects: in-sync / needs-compile / needs-decompile
  compile  --projectid <id>         # .planning/ → sink MDX (all or one project)
           --dry-run                # show what would change, no writes
  decompile --projectid <id>        # sink MDX → .planning/ (all or one project)
            --dry-run
  diff     --projectid <id>         # show diff between .planning/ and sink
  validate --projectid <id>         # check format compliance, report violations
```

### Lossless round-trip requirement
compile(decompile(x)) = x and decompile(compile(x)) = x
No data loss. Every field in .planning/ has a home in sink MDX and vice versa.
If a field exists only in one form → it is a migration gap, reported by `gad sink diff`.

### Mapping table (.planning/ ↔ sink MDX)
| .planning/ file | sink MDX file |
|-----------------|---------------|
| STATE.md | planning/state.mdx |
| ROADMAP.md | planning/roadmap.mdx |
| DECISIONS.xml | planning/decisions.mdx |
| ERRORS-AND-ATTEMPTS.xml | planning/errors-and-attempts.mdx |
| TASK-REGISTRY.xml | planning/task-registry.mdx |
| AGENTS.md | planning/planning-docs.mdx (partial) |
| sessions/*.json | not in sink (ephemeral) |

---

## gad eval status output format

```
GAD Projects — Eval Coverage

  PROJECT          LAST EVAL   SCORE   METHODOLOGY   GAP
  ───────────────────────────────────────────────────────────
  global           v3          0.914   gad-1.32      —
  repo-planner     —           —       —             ⚠ no eval
  grime-time-site  —           —       —             ⚠ no eval
  mb-cli-framework —           —       —             ⚠ no eval
  repub-builder    —           —       —             ⚠ no eval

[YELLOW] = baseline control  [RED] = never evaluated  [DIM] = stale (>30 days)
```

---

## GAD methodology versioning

GAD is a versioned methodology. Evals are pinned to a methodology version.

- Version stored in: `vendor/get-anything-done/package.json` → `"gadMethodologyVersion"`
- Current: 1.0.0 (formalizing now — pre-1.0 was GSD/ralph-wiggum loop)
- Each version tracks: skills list, eval framework version, planning doc format spec
- `gad eval version` shows current version + what changed from previous

---

## gad projects (additions needed)

```
gad projects
  list                              # current — add eval status column
  init    --name --path             # current
  status  --projectid <id>          # sink sync status + eval status + format compliance
  audit                             # all projects: format violations, missing files, sink gaps
```

---

## Format compliance rules (for gad sink validate + gad projects audit)

A planning doc is COMPLIANT when:
1. STATE.md uses plain key-value format (not markdown tables for top-level fields)
2. ROADMAP.md uses checklist format: `- [x] **Phase N: Title** — description`
3. AGENTS.md has: context re-hydration section, docs sink reference, loop steps
4. All file references in STATE.xml/STATE.md are resolvable paths
5. Phase IDs in TASK-REGISTRY match ROADMAP phase IDs
6. All decisions have an id, title, summary, impact

---

## Tracing during migration (planned eval: planning-migration)

During the compile/decompile migration period, every file touch is traced:
- Before state: snapshot of .planning/ and sink
- Each file modified: record old content, new content, format change
- After state: snapshot again
- `gad eval trace --compare before after` shows what changed, what was gained/lost

This IS the evaluation. The migration period is a live eval run.
