# wire-agents-md-context-bootstrap — workflow

Standardize how every project root (including vendor submodules) advertises
its planning surface to coding agents. Task references in CANDIDATE.md
(11-01..11-03) traced repeated drift where AGENTS.md / CLAUDE.md across
roots cited stale planning paths or non-existent commands, costing every
agent ~5-10% of session orientation.

## When to use

- Adding a new project root to the monorepo (apps/*, packages/*, vendor/*).
- Auditing existing AGENTS.md / CLAUDE.md after a CLI rename or planning
  layout change.
- Subagent dispatch: confirming the entry contract before the worker
  spawns.

## When NOT to use

- Touching `vendor/get-anything-done/AGENTS.md` content unsolicited — the
  GAD submodule has its own lane discipline.
- Editing per-host memory files (`.claude/memory/*`) — those are user-local.

## Steps

1. Identify every project root that ships an entry contract. Look for
   `AGENTS.md`, `CLAUDE.md`, or `README.md` siblings to a `.planning/` dir.
2. For each root, confirm the file:
   - Names the project's `--projectid` for `gad` calls.
   - Cites the canonical planning files actually present in `.planning/`
     (TASK-REGISTRY.xml is retired — use `.planning/tasks/<id>.json` per
     decision 63-53; STATE.xml is still active).
   - Lists only `gad <subcommand>` calls that exist in `gad --help`.
   - Names the lane discipline if multiple agents work the tree
     (claude-code / codex / cursor allow + deny lists).
3. Run a smoke check from a fresh shell:
   ```sh
   gad --help
   gad snapshot --projectid <id> --no-side-effects | head -40
   ```
   Any subcommand cited in the entry contract that is not in `gad --help`
   is a stale reference — flag for fix.
4. Update the entry contract to point at:
   - `gad startup --projectid <id>` for first-call orientation.
   - `gad snapshot --projectid <id>` for subsequent calls.
   - `gad tasks add / stamp / promote` for task lifecycle (never raw
     `Edit` on TASK-REGISTRY.xml).
   - `gad state log` for state-log entries (newest-first append).
   - `gad note add <slug>` for long-form context.
5. Cross-link related per-runtime memory:
   - Claude users get `~/.claude/memory/` pointer.
   - Codex users get `vendor/codex-cli/AGENTS.md` pointer when present.
6. If the project participates in `gad subagents dispatch`, the entry
   contract MUST tell the subagent to call `gad snapshot --projectid <id>`
   before its first edit — otherwise the subagent operates blind.

## Guardrails

- Do not invent CLI subcommands. If a behavior is needed but no `gad`
  subcommand exists, file a follow-up task for the framework lane;
  do not document a non-existent command in the entry contract.
- Keep AGENTS.md / CLAUDE.md under 200 lines per file. Move long-form
  context (lane maps, error catalogues) into `references/<topic>.md`.
- Mention SOUL.md only if the project actually carries an active soul;
  for the monorepo root, `SOUL.md` is canonical and cited in CLAUDE.md.

## Failure modes

- **Entry contract cites retired files (TASK-REGISTRY.xml).** Replace with
  the per-task JSON contract (`.planning/tasks/<id>.json`).
- **Entry contract recommends `gad workspace ...`.** That family was
  consolidated into `gad projects ...` in phase 46 (decision gad-208).
- **Entry contract assumes auto-load of SOUL.md.** Per the monorepo
  CLAUDE.md, souls are explicit-only via `gad narrative enter <projectid>`.

## Reference

- `gad-discovery-test` — test harness that catches stale entry contracts.
- `gad-skill-creator` — for promoting this proto-skill.
- Decisions gad-208 (workspace→projects), gad-262 (gad start), 63-53
  (per-task JSON canonical).
