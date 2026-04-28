# coordinated-site-rebrand-pass — workflow

A site rebrand spans 20+ tasks across vocabulary, visual identity, copy,
component data sources, and route topology. Phase 45 (21 tasks, all done)
made the rebrand atomic by sequencing it: project-detail tab shell → data
adapter → vocabulary constants → epigraph registry → component migrations
→ landing composition → visual refresh → vocabulary audit → copy rewrite
→ external docs.

## When to use

- A full site rebrand changing vocabulary, hero, palette, and topology.
- A vocabulary collapse where multiple internal terms map to a new
  display vocabulary (e.g. "eval project" → "Species").
- A topology shift where global pages become per-project pages.

## When NOT to use

- For a single-component visual refresh (just edit the component).
- For copy fixes that don't touch vocabulary (use a regular edit pass).
- For one-off branding (favicon, logo) without a vocabulary shift.

## Steps

1. Land the structural prerequisites BEFORE any visible copy:
   - **Tab shell** at the new route shape (e.g. `/projects/[...id]?tab=`).
   - **Per-project data adapter** (server-side loader returning typed
     props from `.planning/` reads).
   - **API routes** matching the adapter's shape so cross-host consumers
     can call them.
2. Author the vocabulary contract in a single source-of-truth file:
   ```ts
   export const VOCAB = {
     evalProject: 'Species',
     run: 'Generation',
     // …
   } as const;
   ```
   Every component reads from VOCAB; never inline a banned term.
3. Author the epigraph registry (per task 45-05): curated quotes mapped
   to section contexts (hero, planning, evolution, system, findings,
   scoring) with original + adapted variants.
4. Migrate components in waves, by tab:
   - Wave A: Planning tab (Tasks, Decisions, Roadmap+Gantt, Requirements,
     Notes).
   - Wave B: Evolution tab (Workflows, Skill candidates).
   - Wave C: System tab (StatCards, RuntimeActivity).
   Each component flips from app-global to project-scoped, accepting
   `projectId` as a prop and fetching from the adapter.
5. Rewire global routes:
   - Replace monolithic `/planning` with redirect to `/projects` or
     cross-project dashboard.
   - Update marketplace cards to link the new project detail Overview tab.
6. Land the visual + copy refresh AFTER structural migration is green:
   - Type ramp + color palette refresh.
   - Hero copy rewrite + Art of War epigraphs on section dividers.
   - Logo + favicon + OG image.
7. Run the vocabulary audit:
   ```sh
   # banned terms list per decisions gad-166/169/189
   for term in 'eval project' 'GAD+emergent' 'workspace'; do
     grep -rn "$term" site/components/ site/app/ | grep -v VOCAB
   done
   ```
   Every match outside the VOCAB constants file is a regression.
8. Dead-import cleanup. Components superseded by project-scoped versions
   leave orphaned files behind. Audit `site/app/planning/*.tsx` and
   neighbours.
9. Full build + VCS audit:
   - `pnpm run build` passes clean.
   - Every new component has `data-cid` attributes.
   - VCS grep confirms every new section is discoverable.
10. README + external docs copy pass — same vocabulary collapse applied
    to all external-facing docs in one sweep, last.

## Guardrails

- Don't ship a rebrand pass with banned vocabulary still in components.
  The audit is non-optional and runs in CI long after the rebrand.
- Visual refresh AFTER structural migration. Otherwise you debug palette
  + props simultaneously and lose attribution on regressions.
- Migration waves should be commit-atomic per wave, not per file. Reviewer
  sees "Planning tab is now project-scoped" as one diff, not 5.
- Logo/favicon updates require an OG image refresh + metadata sweep
  (apps/*/app/layout.tsx, public/og-image.png, etc.). Every reference is
  a separate file.

## Failure modes

- **Vocabulary regression after merge.** A component bypassed VOCAB. Add
  the banned-term grep to CI as a hard gate.
- **Per-project page misses a tab** because the migration was
  fired-and-forgotten. Maintain a checklist; don't trust grep alone.
- **Epigraph registry duplicates quotes** across sections. Normalize on
  ingest; one quote = one canonical id.
- **Old `/planning` route 404s break inbound links.** Use a redirect
  page for one release cycle; only delete after telemetry confirms zero
  inbound traffic.

## Reference

- Decisions gad-166, gad-169, gad-189 (vocabulary).
- Phase 45 tasks 45-01..45-21.
- `gad-visual-context-system` skill — VCS audit step.
- `coordinated-site-rebrand-pass` is the assembly recipe; component
  migrations may individually use `frontend-design` for visual quality.
