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

## v4 — PENDING (user providing updated requirements)

**Planned changes from v3 (tentative):**
- Floor progression (defeat boss → unlock next floor)
- Respawning encounters (grinding)
- Rune affinity system (specialization, decay, evolution gates, train-at-forge)
- User-authored spells
- Skills system (physical actions, evolve by own XP, supercharge with mana crystals)
- Narrative stats displayed as "Traits"
- Richer room navigation model (rethink rooms)
- Mandatory sprite sourcing (web search or npm packages, not geometric fallbacks)

**Brownfield vs greenfield:**
- Greenfield v4 applies to the 3 greenfield evals (from-scratch implementations)
- Brownfield v4 extensions live in `_brownfield-extensions-v4.md` and apply to brownfield evals (starting from bare v3 baseline)
