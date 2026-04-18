# Evolution on startup — policy

Operator intent 2026-04-18: "I'm surprised we haven't gone through an
evolution and developed proto-skills. I guess our protocol for when to do
that is weak. We were producing candidates on the build of the site. I
think that needs to move over to the startup process of gad and we enter
an evolving stage regardless if we want to or not and then do the
proto-skill and shedding which in the process of shedding should be
removing dead skills or unused skills."

This doc is the policy; the implementation is a codex-lane CLI task
(handoff filed). Policy lives in the framework references tree so agents
can cite it when deciding whether to trigger an evolution.

## Goal

Every `gad startup` call performs a **lightweight evolution step** unless
recently done. Over N sessions, the framework self-refines:

- New candidates surface from recent work (high-pressure phases, repeated
  decisions, recurring error-and-attempt patterns).
- Proto-skills get drafted when a candidate looks universalizable.
- Dead/unused skills get flagged for shedding.

Heavy drafting + shedding only triggers when explicit thresholds are hit
(see cadence rules). Lightweight scan runs every session.

## Cadence

| Step | Runs when | Owner |
|---|---|---|
| **1. Candidate scan** | Every `gad startup` (bounded to ~200 ms) | startup hook |
| **2. Proto-skill draft** | ≥1 new candidate above pressure threshold AND last-draft > 3 sessions ago | triggered, not automatic |
| **3. Shed scan** | Every startup (read-only classification, no deletion) | startup hook |
| **4. Active shedding** | `gad evolution shed` — manual or cron; NEVER auto on startup | operator / scheduled |

Rationale: startup must stay fast + read-only by default. Writes (drafts,
sheds) require explicit operator trigger to avoid surprise deletions and
runaway drafting on every session open.

## Shedding rules — what gets flagged

A skill is a **shed candidate** when ALL of:

1. **Zero real usage in last N sprints.** "Real usage" = `skill=<id>`
   attribute on a completed task in any registered TASK-REGISTRY.xml.
   Sentinel values (`default`, empty string, `none`, `-`, `unknown`) do NOT
   count as real usage. `N` defaults to 3 sprints; configurable per
   project via `gad-config.toml [evolution] shed_lookback_sprints = N`.
2. **Not cited by any active skill.** Parent-child chains are load-bearing
   even when the child hasn't fired recently. Check `parent_skill:` and
   body-level `@skills/<id>` references across the catalog.
3. **Not referenced by a canonical skill's workflow** or the daily-loop
   decisions (`gad-18`, `gad-104`).
4. **Type != `meta-framework`.** Meta-framework skills are used implicitly
   by the evolution pipeline itself; they show up as "unused" in attribution
   but aren't dead.

A skill meeting ALL four is flagged; nothing auto-deletes. Operator runs
`gad evolution shed --confirm <slug>` to actually drop it.

## Current baseline (2026-04-18)

From `lib/skill-usage-stats.cjs` against the 212 real skill attributions
across 10 registered projects:

- 93 cataloged skills
- 13 have real (non-sentinel) usage attribution
- 80 have zero recorded usage
- 5 attributed skills missing from catalog (dead pointers)

Do NOT bulk-shed the 80. Attribution *system* is currently noisy — 162 of
212 attributions were the sentinel value `"default"` before filtering. The
rate of real attribution needs to improve first, or the shed list is full
of false positives.

**Immediate action items (ordered):**

1. **Fix attribution quality** before any shedding. Agents need to stop
   writing `skill="default"` — the `gad tasks release --done --skill <id>`
   CLI should reject sentinel values and require an explicit skill name or
   `--no-skill` if none applies. Captured as a follow-up in the
   skill-hygiene CLI handoff.
2. **Rebuild attribution for recent done tasks** via agent self-audit (a
   meta-framework run: "look at last 20 done tasks, fill in `skill=` where
   you can infer from the goal text"). One-time backfill.
3. **Then shed scan.** Run `gad evolution shed --dry-run` against the
   improved data. Flag candidates. Manual review before any delete.

## Candidate scan — what it actually looks for

On every startup, gather signals:

- **High-pressure phases** with ≥2 tasks done but no skill created for the
  recurring pattern (use `lib/pressure-formula.cjs` output if graph
  includes pressure).
- **ERRORS-AND-ATTEMPTS** with ≥2 instances of the same error code (via
  `.planning/ERRORS-AND-ATTEMPTS.xml`).
- **Repeated decision patterns** — 3+ decisions in the same decision-cluster
  topic that haven't been distilled into a skill.
- **Recurring task goals** — tasks whose goal text clusters to the same
  n-gram signature across projects.

Emit findings to `.planning/.evolution-scan.json` (append-only, timestamped
per scan). The `gad evolution evolve` command reads the latest scan as its
candidate list.

## Startup output contract

Inside the snapshot "HANDOFFS" / "TASKS" block area, append one line when
there's evolution signal:

```
-- EVOLUTION -----------------------------------------------------
  3 candidates surfaced (last scan: 2026-04-18T18:45Z)
  2 skills flagged for shedding (dry-run only)
  Run: gad evolution evolve   |   gad evolution shed --dry-run
-- end evolution --------------------------------------------------
```

Suppressed when all counts are zero. Cap block at 4 lines. Follow snapshot
token-reduction discipline (see `feedback_snapshot_token_cuts` memory).

## Narrative + soul tokens — same discipline

Same linting + token-audit + usage-stats machinery should extend to:

- **Narratives** — `projects/<project>/narrative/*.md` + `narrative.toml`.
  Count tokens per narrative, flag drift from canonical soul body.
- **Souls** — `projects/<project>/narrative/souls/*.md`. Token budget per
  soul; flag souls referenced by zero SOUL.md pointers.

Deferred until the skill surfaces are stable; reusing the same linter +
usage-stats pattern keeps the framework internally consistent.

## Implementation pickup

| Work | Owner | Status |
|---|---|---|
| `lib/skill-usage-stats.cjs` | claude-code | DONE 2026-04-18 |
| `lib/skill-linter.cjs` + token audit | claude-code | DONE 2026-04-18 |
| `references/skill-types.md` (taxonomy) | claude-code | DONE 2026-04-18 |
| `gad evolution scan` CLI | codex | handoff filed |
| Startup hook integration (EVOLUTION block) | codex | handoff filed |
| `gad evolution shed --dry-run` + `--confirm <slug>` | codex | handoff filed |
| Attribution-quality fix (reject sentinel skill=default) | codex | handoff filed |
| Narrative + soul linter | claude-code | deferred, same pattern |
