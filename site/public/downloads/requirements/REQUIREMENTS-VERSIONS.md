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
