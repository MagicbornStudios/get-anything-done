# Strategy pivot — 2026-04-17

Captured from operator directional dump in session 2026-04-17 (post-handoff). This note is the durable record for 22 decisions + 11 phases + parked todos until the `gad` CLI gains `decisions add` / `phases add` / `todos add` subcommands (CLI gap surfaced as its own todo).

## Context

Operator outlined a multi-pronged pivot affecting monorepo shape, desktop client, auth, data model, and framework vocabulary. Today's ship is scoped to (a) clean up and publish the TweakCN-OpenAI fork and (b) capture the full directional dump as planning artifacts. No code written for the large initiatives yet.

## Brand posture

- **No rebrand.** GAD framework name stays. Avoids collision with Context-Evolution-Framework, Skills-as-Genes, Long-Term-Context-Engine (each lacking marketing + off-putting in different ways).
- GAD README + landing page must carry the evolution theme + platform brand. Name = stable, storytelling = needs work.

## Monorepo map (current, pnpm workspaces)

```
custom_portfolio/
├── apps/
│   ├── forge/            (existing)
│   ├── portfolio/        (current marketing/portfolio, not-run-through-GAD, confusing to manage → candidate for archive-as-RE-target-species OR replacement)
│   └── portfolio-v2/     (operator personal site — broken pieces but great content → becomes PILOT SPECIES `personal-portfolio` published to Vercel via GAD)
├── packages/
│   ├── book-components/
│   ├── dialogue-forge/ dialogue-runner/
│   ├── magicborn-cli/
│   ├── repub-builder/
│   └── yarn-{artifacts,compiler-client,runtime-wasm,source}/
├── packages-shared/
│   └── server-template/
└── vendor/
    ├── get-anything-done/ (GAD framework + marketing site)
    ├── repub-builder/
    └── mb-cli-framework/
```

## Monorepo shape (additive plan, no migration)

| Add | Location | Purpose |
|---|---|---|
| `packages/tweakcn-openai/` | monorepo | Extracted TweakCN editor lib, consumed by platform + GAD site Theme nav |
| `packages/editor-core/` | monorepo | Read-only code view + virtual file folder primitive (shared platform + desktop) |
| `packages/gauges/` | monorepo | Decisions / errors-and-attempts / notes / throughput gauge components |
| `apps/platform/` | monorepo | Clerk auth + Supabase + marketplace + user projects + BYOK store |
| `apps/desktop/` | monorepo | Tauri shell: editors, terminals-as-chat, CLI bridge |

`apps/portfolio` — existing marketing site. Becomes RE target species (an eval species publicly benchmarks how well the framework reverse-engineers it into planning docs). Does NOT stop existing.

`apps/portfolio-v2` — operator's personal site. Becomes **pilot species `personal-portfolio`**. Already deployed to Vercel but not through the system. The project represents the "generation" concept; his portfolio is the current generation; framework manages re-publishes going forward. First dogfood of the three-layer iteration model (project / species / generation).

## Decisions (gad-233 .. gad-254)

22 decisions. Once `gad decisions add` exists, port these verbatim into `DECISIONS.xml`.

| ID | Title | Decision |
|---|---|---|
| gad-233 | TweakCN as lib, no auth | TweakCN-OpenAI fork stays minimal. No auth/DB/billing restored there. Consumers handle auth. |
| gad-234 | Platform is separate app | `/platform` is NOT a route section. It's `apps/platform` — its own Next.js app in the monorepo. |
| gad-235 | Portfolio → RE target species | `apps/portfolio` becomes a public reverse-engineering benchmark species. Reverse engineering becomes a staple species type in the system. |
| gad-236 | Desktop client owns editors | Desktop client = Tauri shell hosting editors, terminals-as-chat, CLI installs, agent bridge. |
| gad-237 | Users bring own agent | Users bring their own coding agent (Claude Code, Cursor, etc.). Shared runners + dedicated-server option. Terminal bridge is the chat surface. |
| gad-238 | No rebrand (reversed from initial guess) | GAD name stays. README + landing carry evolution theme. |
| gad-239 | Species = tradable primitive | Species are first-class tradable primitives with their own planning docs (STATE / ROADMAP / DECISIONS / TASKS scoped to species). |
| gad-240 | Three iteration layers planning-gauged | Project / Species / Generation — each has planning docs + gauges. "General term" covers all three. |
| gad-241 | Snapshot token compaction | Snapshot + startup output is token-redundant (phase 42.4 in both; `<references>…</references>` wrappers; closing XML tags). Rewrite to delta format — drop wrapper tags where scalar arrays suffice; dedup startup↔snapshot info. |
| gad-242 | Context surgery R&D | Framework should support surgical context removal during runs — prune redundancy mid-run rather than carrying it. Open R&D. |
| gad-243 | Proto-skill revisit gated | Proto-skill + skill-creation flow gets revisited AFTER VCS findings complete. Current VCS exploration (spatial, drag+depth) surfaces requirements. |
| gad-244 | TweakCN BYOK = client-side | sessionStorage in browser, sent per-request, server never persists. Optional 24h encrypted localStorage toggle. Matches Vercel serverless reality better than encrypted server-side temp. |
| gad-245 | Monorepo = pnpm workspaces | Keep existing. No migration to Turborepo / Nx. Additive packages only. |
| gad-246 | Code editor = read-only | File views in editors are READ-ONLY. Mutations via UI actions or coding agents only. Never hand-typed edits. |
| gad-247 | Skill lanes DEV vs PROD | Skills get `lane: dev \| prod` frontmatter. Catalog filters by lane. DEV = build the thing. PROD = ship / distribute / monetize the thing. |
| gad-248 | Species token = champion-title | Species fork productivity determines token holder. Auto-transfer when fork's generation-count × pressure × contribution exceeds current holder. Original author always referenced. Moderated. |
| gad-249 | Leaderboards | Per species: top contributors. Per generation: top continuers. Both moderated. |
| gad-250 | Pressure ontology (north star) | "Nothing exists in a project / species / generation until pressure is produced." Pressure gates all gauges — decisions / notes / throughput mean nothing without pressure > 0. |
| gad-251 | Gauges = decisions, errors, notes, throughput | VCS hit rate is NOT a gauge. VCS is dev-internal only. Gauges: decision count (direction), errors-and-attempts (stability/reputation), notes (knowledge density), task throughput (realized output). All pressure-gated. |
| gad-252 | Feature-request flow | User's coding agent drafts feature request + README code example → submits to platform → platform's coding agents open PR → human review. User-side customization is local-only until PR reviewed. |
| gad-253 | Supabase stays (for now) | Supabase is already wired. Swap gated on whether virtual-file-folder requirements push it out. Clerk stays definitely. |
| gad-254 | Virtual file folder required | Cloud projects need a virtual file folder UI for users to view (but not edit) project files. Shared primitive in `packages/editor-core`. |

## Phases 47-57 (roadmap additions) — LANDED

Ported to `ROADMAP.xml` via new `gad phases add` this session. Renumbered from proposed 46-56 because phase 46 was already occupied by "Site architecture redesign + CLI consolidation".

| # | Title | Depends | Summary |
|---|---|---|---|
| 47 | TweakCN lib extraction | — | Slice editor surface out of `B2Gdevs/TweakCN-OpenAI` into publishable `packages/tweakcn-openai` — engine, stores, editor page as mountable component. |
| 48 | TweakCN BYOK flow | 47 | Client-side sessionStorage key capture + UI banner + optional 24h encrypted persist. Zero server-side storage. |
| 49 | GAD site Theme nav | 47, 48 | Mount extracted lib under new "Theme" nav item on GAD marketing site. Wire BYOK flow. |
| 50 | Portfolio-v2 as pilot species | — | Treat `apps/portfolio-v2` as pilot species `personal-portfolio`. Wire through GAD. Current Vercel deploy = current generation. First dogfood of project/species/generation model on a real non-eval site. |
| 50.1 | Portfolio → RE target species | — | Set up `apps/portfolio` as a public reverse-engineering eval species. Proves the framework can produce planning docs from a non-trivial existing app. |
| 51 | `apps/platform` scaffold | — | New Next.js app. Clerk auth. Supabase wiring (keep until pushed out). Project / species / generation data model. No features yet — structural. |
| 52 | `packages/editor-core` | — | Read-only code view primitive + virtual file folder UI. Shared between platform + desktop. |
| 53 | `apps/desktop` Tauri shell | 52 | Tauri app. Editors mounted from editor-core. Terminal component = agent chat surface. CLI-install bridge (auto-install or use already-present CLIs). |
| 54 | Species-as-card primitive + token mechanic | 51 | `<SpeciesCard>` primitive. Per-species planning docs (species-scoped STATE / ROADMAP / DECISIONS / TASKS). Champion-title token. Contribution + continuation leaderboards. |
| 55 | Skill lane split (DEV vs PROD) | — | Add `lane:` frontmatter to every skill. Catalog filters by lane. CLI flag `gad skill list --lane prod`. Retag existing skills. |
| 56 | Gauges package | 54 | `packages/gauges` with 4 gauges (decisions / errors / notes / throughput), all pressure-gated. Composable into species cards + project dashboards. |
| 57 | Snapshot token compaction | — | Rewrite `gad snapshot` + `gad startup` output. Dedup startup↔snapshot info. Drop closing XML wrappers where arrays suffice. Target ~40% token reduction at equal information density. |

## Parked todos

Ideas that don't fit a current phase but need to persist:

| Slug | Summary |
|---|---|
| `proto-skill-revisit-after-vcs` | Revisit skill creation flow + proto-skill mechanics after VCS findings (spatial / drag+depth exploration) land. |
| `context-surgery-runtime` | Framework R&D — can we surgically prune context mid-run to eliminate redundancy? Open research direction. |
| `snapshot-compaction-design` | Design doc for phase 56 snapshot rewrite. Before coding: enumerate current redundancies with byte counts, propose delta format, measure. |
| `skill-lane-taxonomy` | Catalog every existing skill into DEV vs PROD before phase 54 implementation. Some skills span both (debug, verify) — decide per-case. |
| `species-token-moderation` | Design moderation rules for champion-title + leaderboards. Who can report? What thresholds auto-freeze a transfer? How do appeals work? |
| `apps-portfolio-current-status` | Audit `apps/portfolio` current state before archiving / converting to RE target species. What Vercel deploy points to it? What's the public URL? |
| `cli-gap-decisions-phases-todos-add` | Add `gad decisions add`, `gad phases add`, `gad todos add` subcommands. Currently no CLI for durable inserts — this note is the workaround. |

## Today's ship (2026-04-17 session, bounded)

| # | Item | Status |
|---|---|---|
| 1 | Commit tweakcn debug-log diff | ✓ done (d3a461b) |
| 2 | Rewrite tweakcn README for fork | ✓ done (4b1f5f9) |
| 3 | Push fork to `B2Gdevs/tweakcn` main | ✓ done |
| 4 | Write this strategy-pivot note | ✓ done |
| 5 | Add decisions gad-233..gad-254 to DECISIONS.xml | ✓ landed via new `gad decisions add` (CLI gap fixed this session) |
| 6 | Add phases **47-57** (shifted from proposed 46-56 — phase 46 was already occupied by "Site architecture redesign + CLI consolidation") | ✓ landed via new `gad phases add` |
| 7 | Add 7 parked todos | ✓ landed via new `gad todos add` |
| 8 | Update STATE next-action | ✓ updated (462/600 chars) |
| 9 | **CLI gap fixed mid-session** | ✓ `lib/decisions-writer.cjs`, `lib/roadmap-writer.cjs`, `lib/todos-writer.cjs` + wired subcommands in `bin/gad.cjs`. Backward-compat via injectDefault. |

## Handoff for next session

1. Run `gad startup --projectid get-anything-done`; save session id.
2. Read this note.
3. Decide whether to (a) ship `cli-gap-decisions-phases-todos-add` first so the 22 decisions + 11 phases can land in XML before any other work, or (b) just hand-edit once as an exception given the size.
4. If (a): implement `gad decisions add <id> --title "..." --text "..."`, `gad phases add ...`, `gad todos add ...` in `bin/gad.cjs`. Estimated ~1-2 hours. Then port all 22 decisions + 11 phases + 7 todos from this note.
5. If (b): port directly and accept the memory violation for this batch. Add the CLI gap to backlog anyway.
6. Then pick phase 46 (TweakCN lib extraction) as first execution target.
