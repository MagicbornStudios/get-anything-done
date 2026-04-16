# Site article — The cost of parallel subagents

**Source:** Session 2026-04-16d (operator request after cost-breakdown SITREP)
**Area:** landing site content / methodology
**Urgency:** medium

## What

Standalone info article on the landing site breaking down the overhead of
running subagents in parallel on a shared repo / submodule. Written as the
counterpart to the "GAD loop is simple" framing — *why parallel agents are
not free*, and what a framework has to change to make them cheap.

## Surface options

- `/articles/parallel-subagent-cost` — standalone long-form article
- `/how-it-works#parallelism` — section within existing how-it-works page
- `/methodology` — if that route exists post-rebrand

Prefer standalone article + link from /how-it-works. Article is referenceable
externally; page section is not.

## Outline (from session SITREP)

1. **Worktree provisioning** — per-agent git worktree, disk, dep install, teardown
2. **Cold-start context** — each agent re-runs `gad snapshot` (~7k tokens),
   re-reads skills, pays a full cache-miss
3. **Shared-file contention** — TASK-REGISTRY.xml / STATE.xml / DECISIONS.xml
   are single shared-write surfaces — three agents = three edits to the same
   phase subtree = structural merge conflict
4. **Reintegration review** — main session must read each diff, run each
   build, verify attribution per GAD loop
5. **Gating latency** — slowest agent gates the batch; total wall = max + review
6. **Debug isolation loss** — serial makes the broken commit obvious; parallel
   lands three commits together, bisect needed
7. **When parallel IS worth it** — criteria table (task > 60min, zero shared
   files, independent build surface, no main-session context needed)

## Structural fixes preview (link to other todos)

- Outbox pattern for per-agent scratch task files
  — see `2026-04-16-structural-parallelism-task-outbox.md`
- Scoped snapshot + lightweight agent profile
  — see `2026-04-16-lightweight-agent-and-scoped-snapshot.md`

## Data to surface

- Real numbers from any future parallel eval run (token spend, wall time,
  conflicts encountered) — article should graduate from theoretical to
  measured once data exists
- Cross-link: decision gad-195 (active vs static context cost)

## Next step

Draft copy in `vendor/get-anything-done/site/app/articles/parallel-subagent-cost/page.tsx`
after TRACK A (site rebrand nav+home) lands. Belongs in the rebrand wave
because it's externally visible content.
