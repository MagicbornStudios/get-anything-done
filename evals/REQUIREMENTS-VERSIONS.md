# Game Requirements Version History

Version log for `escape-the-dungeon*` REQUIREMENTS.xml files. Every change requires a new
version tag and an entry here. Evals must reference `requirements_version` in TRACE.json.

---

## v1 — 2026-04-06

**Scope:** Systems-focused. 12 success criteria describing what the agent should build.
No gates. No UI quality mandate. No priority on vertical slice.

**Problems that emerged:**
- Agents built invisible backend systems with no UI
- requirement_coverage scored 1.0 while the game showed a blank screen
- No way to distinguish "code exists" from "game works"

---

## v2 — 2026-04-08

**Changes from v1:**
- Added 2 gate criteria (production build renders, playable vertical slice)
- Added `<vertical-slice>` section describing the UI-first build order
- Marked gates with `gate="true"` attribute
- Trimmed source gameplay design doc from 640 → 127 lines

**Scoring impact:**
- Gate criteria override: if any `gate="true"` fails, requirement_coverage = 0

**Problems that emerged:**
- Gates helped but bare and GAD still produced broken game loops
- UI quality gate was vague — agents produced "raw ASCII" output and claimed it passed
- Rune forge (spell crafting) was listed as a criterion but always skipped

---

## v3 — 2026-04-08

**Changes from v2:**
- Restructured into explicit `<gate-criteria>` section with 3 numbered gates
- **G1 Game loop**: complete cycle title → new game → room → navigate → combat → return → continue
- **G2 Spell crafting**: rune forge with combine → create → use. Loot doesn't count.
- **G3 UI quality**: icons, styled buttons, HP bars, room-type differentiation, entity sprites/portraits
- Added asset sourcing guidance (npm packages > web search > generated > geometric fallback)
- Added `<vertical-slice>` build order (UI first, systems after)
- Explicit "don't get stuck gold-plating" guardrail for assets

**Scoring impact:**
- Composite formula v3: weights (0.15, 0.15, 0.15, 0.10, 0.05, 0.30)
- human_review weight 0.30 (up from 0.15)
- Low-score caps: < 0.20 → 0.40, < 0.10 → 0.25

**Problems that emerged:**
- Rune forge was built but not integrated with progression (no affinity, no evolution, no training)
- No floor progression — players stuck on first floor forever
- No grinding / respawning encounters
- Skills (physical actions) vs spells (mana) not differentiated
- Narrative stats shown as labels that confused players — needed to be called "Traits"
- Agents ignored asset sourcing and used raw text-only UI

---

## v4 — 2026-04-08

**Core shift from v3:** Pressure-oriented design. Previous versions were feature
checklists. v4 reframes around "every system must create friction that rewards
creative player choice." Central principle: **baseline starter abilities must NOT
be sufficient to comfortably complete a full floor**.

**Changes from v3:**
- Authored-only (explicitly no procedural generation)
- Floors → Rooms → Boss gate hierarchy; 5-8 rooms per floor
- Room types: Combat, Elite, Forge, Rest, Event (mechanically distinct)
- Each floor must introduce a mechanical constraint that can't be brute-forced with default spells
- Respawning encounters on cleared floors allowed (grinding)
- G2 forge gate expanded: not just "crafting exists" but **at least one encounter per floor must significantly favor crafted/adapted spells**
- G4 pressure mechanics gate added: must include at least 2 of (resource pressure, enemy counterplay, encounter design pressure, build pressure)
- New ingenuity_score dimension measures whether player had to adapt
- Skills system: scored (not gate) — combat must support at least one non-spell action category but full skill system is bonus
- Asset sourcing: attempt-first workflow (find-sprites skill), coherent fallback allowed only when sourcing genuinely fails
- Terminology split: UI shows "Traits", code uses `narrativeStats`

**Deferred to v5:**
- Rune affinity decay when unused
- Deep evolution trees (multi-stage mutations)
- Full authored spell customization (naming still allowed in v4)

**Scoring impact:**
- Gates: game-loop, forge-with-ingenuity-payoff, ui-quality, pressure-mechanics (4 gates now)
- Composite weights unchanged from v3 (human_review 0.30, low-score caps)
- New ingenuity_score as a scored dimension (not yet in composite — evaluated in round 4 results)

**Brownfield vs greenfield:**
- Greenfield v4 applies to escape-the-dungeon, escape-the-dungeon-bare, escape-the-dungeon-emergent
- Brownfield v4 extensions live in `_brownfield-extensions-v4.md` (similar direction, applied to bare v3 baseline)

**Decision references:** gad-41 (pressure reframe), gad-42 (skills scored), gad-43 (sprite sourcing), gad-44 (Traits terminology), gad-48 (GAD diagnosis deferred)

---

## v5 — 2026-04-09

**Core shift from v4:** Playtest-driven expansion. v4 was a designer rewrite; v5 comes entirely from user play of Bare v5 (0.805 rubric), Emergent v4 (rescored to 0.885 after user beat floor 1), GAD v9 (rate-limited), and GAD v10 (api-interrupted). Everything in v4 still applies — v5 adds 21 new/amended requirements (R-v5.01..21) on top as a structured `<addendum>` section inside the same template XML.

**Changes from v4:**
- **R-v5.01** Training via encounter, not menu — affinity rises from casting, not selecting. Training Dummy encounter room type.
- **R-v5.02** Rune discovery as a gameplay loop — starter subset only, rest found in world, one rune per floor gated behind non-combat.
- **R-v5.03** Merchants with buy/sell/trade — at least one per floor, gold as tracked resource.
- **R-v5.04** NPC dialogue with branching outcomes — 3+ NPCs, 2+ branches each, choices change game state.
- **R-v5.05** Inventory/bag with grid + equippable items — weapon/off-hand/body/trinket slots affecting stats.
- **R-v5.06** Visible character sheet + skill tree — physical/combat skills separate from spells, distinct resource.
- **R-v5.07** Spell and skill loadout slots — forced specialization as a build-pressure mechanic.
- **R-v5.08** Progression sources sufficient to reach end boss (amends G1) — guaranteed mana-max / spell-power upgrade per floor.
- **R-v5.09** Save checkpoints + continue-after-death (amends G1) — Continue must never hard-brick.
- **R-v5.10** Notification lifecycle (amends G3) — auto-dismiss, clear on new game, no persistence across sessions.
- **R-v5.11** Rest rooms must offer rest — forge rooms combining Forge+Train+Rest must expose Rest as an action.
- **R-v5.12** Navigation and map usability (amends G3) — minimum 2D graph layout, one-click navigation.
- **R-v5.13** Combat model must be explicitly chosen — **Model A (rule-based simulation, Unicorn-Overlord-style)** preferred over direct-control.
- **R-v5.14** Action policies driven by entity traits — applies to enemies AND NPCs; dialogue changes with trait shifts.
- **R-v5.15** Real-time game-time model — 1hr real = 1 day game, remove tick system, UI time-shading is soft.
- **R-v5.16** Affinity reward loop — visible payoff for boosting a rune, not just a hidden stat.
- **R-v5.17** Central visual navigation map with player token (stronger form of R-v5.12).
- **R-v5.18** Visual player vs enemy identity — Pokemon / Unicorn Overlord style (UO preferred).
- **R-v5.19** Spells as craftable ingredients — spells + runes both combine, procedural-but-semantic naming. Explicitly mirrors the emergent-evolution hypothesis (gad-68) as an in-game narrative analogue.
- **R-v5.20** Rune uniqueness within a single spell — bug fix for Bare v5's double-affinity exploit.
- **R-v5.21** Event-driven rendering — kill the per-tick redraw glitches observed across ALL round-4 builds.

**Scoring impact:**
- v4 gates remain (G1, G2, G3, G4). v5 amendments tighten G1 (death/continue, end-boss reachable), G2 (training is encounter-driven), G3 (notification lifecycle, map usability).
- New scored dimensions: `inventory_and_equipment_present`, `npc_dialogue_present` — not gates, but meaningful score hits if missing.
- Rubric weights unchanged from v4.

**Deferred to v6:**
- Deep evolution trees (multi-stage mutations).
- Rune affinity decay when unused.
- Multi-character party play — out of scope for escape-the-dungeon family.

**Brownfield vs greenfield:**
- Greenfield v5 applies to escape-the-dungeon, escape-the-dungeon-bare, escape-the-dungeon-emergent (same three templates all updated together).
- Brownfield v5 extensions are not yet authored — round 5 starts greenfield-first.

**Round 5 unblock:** This version is the trigger for round 5. Round 5 runs serially (gad-67) against this requirements set. HTTP 529 investigation + GAD v11 retry queued, see task registry.

**Source:** `evals/_v5-requirements-addendum.md` holds the prose version with full user rationale quotes. The XML addendum in each template is the machine-readable form.

**Decision references:** gad-65 (CSH), gad-68 (emergent-evolution), gad-71 (data/ pseudo-database for bug tracking), gad-72 (rounds framework — this is now round 5), gad-73 (fundamental skills triumvirate — the R-v5.19 spells-as-ingredients mechanic is the in-game analogue).
