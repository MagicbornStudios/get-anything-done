# build-dna-editor-surface — workflow

The DNA Editor (decision gad-198) surfaces a project's skill lifecycle
across four states (DNA, Expressed, Mutation, Shed) inside a local-dev
authoring surface. Phase 44.5 built it in 25 tasks; the reusable pattern
is a four-pane lifecycle viewer wired to the Visual Context System with
dev-bridge action wiring.

## When to use

- A new project needs an authoring surface over its skill DNA + sandboxes
  + proto-skills + shed candidates.
- Extending the DNA Editor with a new gene state.
- Adapting the pattern to another lifecycle viewer (recipes, generations,
  any 3-5-state object collection that shares the lifecycle shape).

## When NOT to use

- For a read-only catalog (use the bestiary card pattern instead).
- For production surfaces — DNA Editor is `NODE_ENV=development` only.
- For non-skill lifecycles (this skill's vocabulary is locked to the
  gad-198 model; recipes/generations have their own surfaces).

## Steps

1. Scaffold the route via `scaffold-visual-context-surface` skill (decision
   gad-198 mandates the 6-step VCS scaffold). Pane shell cid:
   `dna-editor-pane-site-section`. Four state-group cids:
   `dna-editor-state-{dna,expressed,mutation,shed}-site-section`. Row
   prototype cid: `dna-editor-gene-<slug>-site-section`.
2. Population sources (read-only first; actions land separately):
   - **DNA**: enumerate `.claude/skills/` (or per-runtime skills dir),
     read SKILL.md frontmatter for name/description/status.
   - **Expressed**: enumerate `.gad-try/<slug>/` sandboxes, read
     PROVENANCE.md (source/kind/staged_on) + ENTRY.md (handoff prompt).
   - **Mutation**: enumerate `.planning/proto-skills/<slug>/`, read
     PROVENANCE status + SKILL.md name + VALIDATION.md verdict.
   - **Shed**: enumerate shed-score data + manually-flagged entries.
3. Wire actions through the dev-server command bridge (NODE_ENV-gated,
   per task 44.5-02b allow-list):
   - DNA: (no actions, read-only)
   - Expressed: `Try`, `Cleanup`, `Copy prompt`, `Preview`
   - Mutation: `Promote` (`gad evolution promote <slug>`), `Shed`
     (`gad evolution shed <slug>`), `Preview`, `Copy prompt`
   - Shed: (no actions; archive-only view)
4. Each button is a SiteSection with deterministic cid:
   `dna-editor-action-<verb>-<slug>-site-section`.
5. Iframe preview (per 44.5-14): detect generic `index.html`, `graph.html`,
   or SKILL.md-declared `outputs:` path. Iframe wrapper cid:
   `<slug>-preview-iframe-site-section`.
6. Command+K shortcuts (per 44.5-15): `try <ref>`, `promote <slug>`,
   `shed <slug>`, `preview <slug>` autocomplete from enumerated genes.
7. Provide a dev-panel badge: "DNA Editor (dev mode)" so the operator
   sees the gate status.
8. Round-trip one modal-footer CRUD prompt against a real cid BEFORE
   wiring features. Proves the VCS is live.

## Guardrails

- The four-state vocabulary is locked per decision gad-198 — do not
  rename `DNA / Expressed / Mutation / Shed` to align with other models.
- Production guard: every dev-bridge route rejects on
  `NODE_ENV !== 'development'` at module load (not just at request time).
- All cids must be string literals — VCS panel scan uses static grep,
  not runtime evaluation.
- Action buttons stream stdout via SSE; never block the UI on subprocess
  exit.

## Failure modes

- **VCS panel doesn't see new cids.** Cid was computed (`${prefix}-...`)
  instead of literal. Add a literal-prototype comment for the row family
  and confirm with `grep "<exact-cid>" site/`.
- **Promote action mutates an inherited skill.** The Mutation pane should
  only show `.planning/proto-skills/<slug>/` entries — confirm population
  source filters.
- **Iframe preview fails for non-HTML outputs.** Per 44.5-14 fallback,
  show "no viewable artifact" placeholder instead of crashing.

## Reference

- Decision gad-198 (two-verb express/integrate model).
- `scaffold-visual-context-surface` skill (mandatory scaffold).
- Phase 44.5 tasks 44.5-11 / 44.5-12 / 44.5-13 / 44.5-14 / 44.5-15.
- `references/skill-lifecycle.md` (verb collapse documentation, task 42.2-46).
