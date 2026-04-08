# Eval: reader-workspace

**Project:** Reader Workspace (EPUB reader UI)
**Source:** Reverse-engineered from `vendor/repub-builder/src/reader/` via `gad:reverse-engineer`

## Goal

Validate that a GAD agent can re-implement a production EPUB reader workspace from
structured requirements alone (no access to the original source code). This eval measures:

1. **Feature coverage** -- does the implementation satisfy all 51 success criteria?
2. **Architecture alignment** -- does the agent make structurally similar decisions?
3. **State hygiene** -- does STATE.xml stay clean and accurate after each phase?
4. **Convention adherence** -- does the code follow the documented conventions?
5. **Token efficiency** -- total tokens consumed vs. number of criteria satisfied

## Requirements

### Project type

Standalone React/TypeScript package exporting an EPUB reader workspace as a reusable
component library. Shipped via sub-path export (`./reader`).

### Stack

- React 19, TypeScript
- react-reader v2 (epubjs wrapper) for EPUB rendering
- zustand v5 with persist + immer for client state
- framer-motion for animated transitions
- lucide-react for icons
- jszip for ZIP archive manipulation
- Tailwind CSS with shadcn semantic tokens
- tsup for ESM build
- vitest for tests

### Milestone

M1: Reader Workspace -- full re-implementation of the reader UI from requirements.

### Phase sequence expected

1. Foundation (types, utilities, UI primitives, build scaffold)
2. Chrome theme and empty cover
3. Reading stores and progress tracking
4. Workspace UI store and shelf catalog
5. Annotations engine (IndexedDB, SHA-256, JSON export, EPUB embedding)
6. EpubViewer (react-reader integration, themes, navigation, annotations UI)
7. Workspace state and shelf card
8. Sidebar navigation (desktop rail, mobile drawer)
9. Modal system and planning strip
10. ReaderWorkspace orchestration (compose all subsystems)
11. Planning pack extraction from EPUB
12. Public API and package exports

## Success criteria

| Criterion | Pass threshold |
|-----------|----------------|
| Requirement coverage | >= 90% of 51 success criteria met |
| Phase plan quality | >= 80% structural overlap with reference roadmap |
| All tasks executed | 100% (no silent skips) |
| STATE.xml valid | Parses correctly after each phase |
| Conventions followed | >= 80% alignment with CONVENTIONS.md patterns |
| Decisions aligned | >= 8 of 12 reference decisions reflected in implementation |

## Scoring weights

| Dimension | Weight |
|-----------|--------|
| requirement_coverage | 0.40 |
| architecture_alignment | 0.25 |
| state_hygiene | 0.20 |
| convention_adherence | 0.15 |

## Baseline

First run establishes the baseline. Subsequent runs compare against it.

## Public reference (not part of the scored worktree)

The **eval** is “agent implements from requirements **without** the reference repo.” For **humans** who want a working EPUB3 reader and **visible production code**, use the **custom_portfolio** monorepo:

- **Live UI:** `/apps/reader` on the deployed portfolio — built-in catalog plus **library upload** for EPUB3 files.
- **Code:** `apps/portfolio/components/books/ReaderWorkspace.tsx` and `vendor/repub-builder/src/reader/` (`@portfolio/repub-builder`).

That is the implementation the eval is designed to **approximate**, scored separately.

## Notes

- The eval template provides REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml,
  and STATE.xml -- the agent builds from these alone
- No source code from the reference implementation is included
- The agent must create a functional React package, not just planning docs
- Planning pack extraction (phase 11) depends on a planning-pack-manifest module that
  may need to be stubbed or simplified in the eval context
- The agent should install react-reader, zustand, framer-motion, lucide-react, and jszip
  as real dependencies
