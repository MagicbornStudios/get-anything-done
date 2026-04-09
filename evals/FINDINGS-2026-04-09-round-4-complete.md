# Round 4 — complete v4 results (serial execution)

**Date:** 2026-04-09
**Requirements version:** v4 (pressure-oriented, 4 gates, authored dungeon, ingenuity-required)
**Framework version:** v1.32.0 + commit 459dc36 (trace hooks live, framework-stamped TRACE.json)
**Execution model:** serial (per decision gad-62, after round 4 attempt #1's rate-limit failure)

## Summary

Round 4 ran three greenfield conditions sequentially against v4 pressure-oriented
requirements. Two completed cleanly. One (GAD) was interrupted twice by Anthropic API
overload errors (HTTP 529), landing with the fullest planning suite captured to date
but the lowest shippable-gameplay coverage. Despite the interruption, **the GAD v10
result is the strongest freedom-hypothesis signal in the entire dataset**: it used
MORE tool calls (55) than either completed run (45) and shipped LESS playable game.
The framework's planning + data-authoring overhead consumed the budget before scene
implementation could begin.

## The numbers

| Condition | Tool uses | Wall clock | Tokens | TS lines | Dist | Playable | Skills authored | Gates self-traced |
|---|---:|---:|---:|---:|---|---|---|---|
| **Bare v5** | 45 | 12.5 min | 96030 | ~700 | ✓ 65 KB | ✓ 2 full floors | 0 new | all 4 pass (agent report) |
| **Emergent v4** | 45 | 11.5 min | 95509 | ~650 | ✓ 55 KB | ✓ 2 full floors | **2 new** + CHANGELOG | all 4 pass (agent report) |
| **GAD v10** | 55 | 9 min | 1216 | 875 | ✓ scaffold only | ✗ title screen only | 0 new | 0 of 4 (API interrupted) |

Token count for GAD v10 is 1216 because the API 529 happened before the final message
summary — the actual token consumption was likely similar to the other two (~80-100k)
but wasn't recorded in the completion notification. Tool uses and wall clock are
reliable.

## What each condition actually shipped

### Bare v5 — 2 floors × 8 rooms, 10 rune combinations, playable

- **Stack decision**: DOM + TypeScript + Vite + iconify-icon + @iconify-json/game-icons. Explicitly rejected KAPLAY in worklog.md with rationale ("better for action games; this is a menu-driven roguelike").
- **Content authored**: 5 runes (F/I/P/B/S), 10 authored craftable combinations, 2 floors × 8 rooms, 8 enemies including 2 elites and 2 bosses, 2 event rooms with 3-choice consequences.
- **Forced-craft encounters**:
  - Floor 1: Stone Warden (physical 0.25 damage taken — requires elemental spells) + Fungal Sovereign (fire immune, ice weak — requires ice-crafted spells)
  - Floor 2: Mirror Djinn (40% reflect — DoT-only counter) + Pyre Lich (fire immune + 30% reflect, requires DoTs crafted from poison runes)
- **Mana economy engineered**: agent did the literal math — bumped starter mana 12→18 and boss HP 50→42 after calculating that a Frostfire (3 casts × 17 dmg = 51) at rest-capped (85%) mana could just barely clear the 42-HP boss. That's engineering for the G2 ingenuity-payoff clause, not guessing.
- **UI**: dark-fantasy palette, HP/MP gradient bars, per-room-type backgrounds, iconify game-icons throughout, Map/Spellbook/Traits/Bag overlays, styled buttons. No raw ASCII anywhere.
- **Save/load**: localStorage-backed. Can resume a run.
- **Bootstrap skills only**: create-skill.md + find-sprites.md copied from template, no new skills authored.
- **Worklog**: flat `worklog.md` tracking 10-step plan. No phase boundaries or formal task IDs.

### Emergent v4 — 2 floors × 8 rooms, 7 rune combinations, playable, **2 new skills**

- **Stack decision**: DOM + TypeScript + Vite + iconify-icon + @iconify-json/game-icons. **Arrived at the same DOM conclusion independently** — the inherited `kaplay-scene-pattern.md` skill was actively marked deprecated in this run's CHANGELOG with rationale.
- **Content authored**: 6 runes, 7 crafted combinations, 2 floors × 8 rooms (start, combat, forge, event, rest, combat, elite, boss), authored JSON data files under public/data/.
- **Forced-craft encounters**:
  - Floor 1: stone_golem and warden_f1 resist direct damage 65% — DoT spells (Ember Hemorrhage, Rotbloom) bypass the resistance.
  - Floor 2: thornwretch and warden_f2 reflect 50% of direct damage — DoT-only spells (Rotbloom, Hexroot) are the intended counter.
- **UI**: Cinzel serif font, gold/arcane/blood palette, HP/mana bars with fill + text overlay, damaged-shake animation, bonfire flicker, room-type theming via `data-theme` + `--room-accent`, mini-map sidebar with discovered/cleared state. Fog-of-war reveal.
- **Skills evolved** (the real signal):
  - `dom-over-kaplay.md` (NEW) — captures the methodology decision for the next emergent run. Documents why DOM + iconify beats KAPLAY for menu-driven roguelikes, notes the runtime caveat that Iconify fetches SVG from CDN on first paint.
  - `pressure-forge-coupling.md` (NEW) — captures the v4 ingenuity clause recipe: per-floor enemy resistance/reflect + crafted-spell counter. This is the design pattern both Bare v5 and Emergent v4 independently discovered, now codified as a reusable skill.
  - `kaplay-scene-pattern.md` — marked **deprecated for UI-heavy domains**, kept in place for lineage.
  - `CHANGELOG.md` — documents disposition of each inherited skill + guidance for emergent v5.
- **The inheritance ratcheting mechanism works**: next emergent run (v5) will start with 9 inherited skills including the 2 fresh ones. The knowledge compounds across rounds.

### GAD v10 — **full planning suite, data layer, zero scenes**

- **Stack decision**: DOM (explicitly documented in DECISIONS.xml — took the signal from bare/emergent) + Vite + TypeScript + iconify-icon. Same stack as the others.
- **Planning suite authored** (fullest captured to date):
  - `ROADMAP.xml` — 7 phases: scaffold, core-state-and-content, title-and-hud, room-navigation, combat, forge-and-runes, pressure-encounters
  - `TASK-REGISTRY.xml` — ~20 tasks with IDs (01-01 through 07-xx) and status fields
  - `STATE.xml` — current-phase 02, current-plan "core-state-and-content", next-action "Phase 02: data layer. Start with task 02-01 (src/types.ts)"
  - `DECISIONS.xml` — scaffolded
  - `VERIFICATION.md` — phase 01 verified as PASS
- **Content authored (phase 02, 875 lines TS)**:
  - `types.ts` — 137 lines of entity/combat/narrative stat shapes
  - `state.ts` — 72 lines of game state module
  - `content/runes.ts` — 221 lines of rune data + crafting combinations
  - `content/floors.ts` — 224 lines of authored 2-floor × 8-room graph
  - `content/enemies.ts` — 160 lines of enemy definitions
  - `content/events.ts` — 43 lines of event rooms
  - `main.ts` — 7 lines (stub: imports router and mounts)
  - `scenes/router.ts` — 11 lines (stub: renders a static title screen "ESCAPE THE DUNGEON v10 — scaffold booted")
  - `styles.css` — basic title styling
- **What's missing**: scenes/title (real), scenes/room, scenes/combat, scenes/forge, scenes/event, scenes/rest, HUD, save/load, any interactivity beyond the scaffold title
- **Gates self-traced**: 0 of 4. None were implemented. The scaffold title doesn't count as G3.
- **API interrupted twice**: attempt #1 crashed at tool_uses 18 / 2.3 min (pruned fresh); attempt #2 crashed at tool_uses 55 / 9 min (preserved as v10).

## The three-way comparison under v4

### Design convergence

**All three conditions independently arrived at the same macro design**:
- DOM over KAPLAY
- iconify-icon + @iconify-json/game-icons for UI
- 2 floors × 8 rooms with authored encounters
- Runes + combinations → crafted spells
- Per-floor resistance/reflect encounters requiring specific crafted counters

This is a strong signal that the v4 REQUIREMENTS.xml is narrow enough to funnel
competent agents toward the same solution. The spec does what it was designed
to do: it constrains the solution space.

### Implementation velocity

| Condition | Tool uses | Scenes implemented | Playable loop |
|---|---:|---:|---|
| Bare v5 | 45 | 6+ (title, room, combat, forge, event, rest) | ✓ |
| Emergent v4 | 45 | 6+ (title, room, combat, forge, event, rest + victory) | ✓ |
| GAD v10 | 55 | 1 stub (router with title screen) | ✗ |

**GAD used 22% more tool calls and shipped 0% of the playable scenes.** The difference
went entirely to planning + data authoring. Had GAD not been API-interrupted, it might
have caught up — but the same 45-tool-use budget that Bare and Emergent used to ship
a game was insufficient for GAD to reach scene implementation at all.

### The freedom hypothesis, round 4 verdict

**The freedom hypothesis holds under v4 pressure requirements — possibly more strongly
than under v3**.

Round 3 (v3 requirements): Bare v3 human review 0.70, GAD v8 human review 0.20. Framework
vs direct implementation, bare wins on creative output.

Round 4 (v4 requirements): Bare v5 and Emergent v4 both ship complete playable games
with all 4 gates self-traced passing. GAD v10 ships zero scenes after 55 tool uses.

The v4 gates were DESIGNED to require ingenuity (the forced-craft encounter pattern),
which should have favored a framework-driven deliberate approach. Instead, the direct-
implementation conditions shipped the ingenuity and GAD didn't ship anything playable.

**Caveat**: API 529 interrupted GAD. A completed GAD run might reach all 7 phases.
But the tool-use accounting is damning regardless — at minute 9 of a 12-minute wall
clock budget, Bare and Emergent were finishing polish while GAD was still writing data
files. The overhead is real.

### Workflow emergence — the quiet winner

The most interesting finding isn't the GAD-vs-bare comparison, it's **Emergent working
as designed for the first time**:

- Inherited 7 skills from previous runs
- Applied them (DOM over KAPLAY inherited from previous emergent runs' failures)
- Evolved them (deprecated `kaplay-scene-pattern.md` in place)
- Authored 2 new skills that codify round 4 learnings:
  - `dom-over-kaplay.md` — the stack decision with rationale
  - `pressure-forge-coupling.md` — the v4 encounter design pattern
- Wrote CHANGELOG.md for the next emergent run to inherit

This is the **knowledge ratcheting mechanism** working end-to-end in a single session.
Every previous emergent run either inherited without evolving or authored without
reflecting. v4 is the first run where the full inheritance → apply → evolve → document
cycle completed. The next emergent run (v5) will start with 9 inherited skills and
visible lineage of what each one taught.

## API reliability as an experimental variable

Both GAD attempts hit HTTP 529 overloaded_error. This is Anthropic-side server load,
not anything the framework can fix. It is now an **experimental variable** we have to
acknowledge:

- Bare and Emergent ran 12-13 minutes uninterrupted
- GAD's first attempt died at 2.3 min, second at 9 min
- The pattern isn't random — GAD's longer setup phase (snapshot + planning + XML writes)
  may spend more time in server-dependent states, giving 529s more opportunities to land

**Decision candidate (gad-64)**: eval runs that hit API errors (not rate limits) should
be categorizable separately from rate-limited runs. Current `timing.rate_limited`
captures account-cap failures; add `timing.api_interrupted` + `timing.interruption_reason`
for server-side failures. Both should filter out of cross-round comparisons by default.

## What to do next

1. **Accept v10 as the GAD round 4 data point.** Retrying a third time is unlikely to
   succeed given the 529 pattern, and the partial data is already informative.
2. **Human review Bare v5 and Emergent v4**. Both shipped complete games. Score them
   under the rubric (playability, ui_polish, mechanics_implementation,
   ingenuity_requirement_met, stability). Rubric phase 27 track 1 exists in planning
   but hasn't been executed — this is the natural trigger.
3. **Don't human-review GAD v10**. The agent's own self-assessment is correct: the
   game doesn't exist beyond a scaffold title screen. Leave `humanReview.score` null
   and let the api_interrupted flag exclude it from aggregates.
4. **Ship round 4 completion on the site**. Copy all three dists to
   `site/public/playable/`, regen prebuild, and let the Graphs scatter render the
   two completed runs (v5, v4) against the historical dataset. v10 shows on its
   per-run page with the api_interrupted badge but doesn't pollute the aggregates.
5. **Queue phase 27 track 1 (rubric)** for the next session so Bare v5 and Emergent v4
   can be reviewed under the new structured rubric instead of a single-score blob.
6. **Document the v10 story on the site**. A paragraph on `/findings/2026-04-09-round-4-complete` explaining why GAD's tool-use count is higher and implementation depth
   is lower. Include the 875-lines-of-TS breakdown. This is the concrete, numerical
   freedom-hypothesis evidence the earlier rounds hinted at.

## Cross-round comparison

Freedom hypothesis across rounds (human-reviewed runs only, rate/api failures excluded):

| Round | Req version | GAD best | Bare best | Emergent best | Hypothesis |
|---|---|---|---|---|---|
| Round 1 | v1 | etd v5 = 0.00 (blank screen) | — | — | not testable |
| Round 2 | v2 | etd v7 = 0.30 | bare v2 = 0.50 | emergent v1 = 0.10 | Bare slight edge |
| Round 3 | v3 | etd v8 = 0.20 | bare v3 = 0.70 | emergent v2 = 0.50 | **Bare wins decisively** |
| Round 4 | v4 | **v10 = N/A** (api interrupted at phase 02) | **v5 = pending review** | **v4 = pending review** | **Bare + Emergent ship, GAD doesn't** |

The round 4 GAD cell is "N/A" because API failure, not because GAD performed poorly
on a scored dimension. But the tool-use accounting is clear: 55 tool uses → no
playable game is a worse ratio than 45 tool uses → playable game. Even if a completed
GAD run would have outscored the others on polish or architecture, it would have
needed significantly more budget to get there.

## Decisions logged

- **gad-64** (to write): api_interrupted flag in TRACE.json timing separate from
  rate_limited. Both filter from cross-round aggregates. The reason matters for
  interpreting the data — "Anthropic was overloaded" is different from "the agent
  hit its account quota."
