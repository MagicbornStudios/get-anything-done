# Eval: reader-workspace v2


You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Agent guide -- Reader Workspace (eval project)

**You are inside a GAD eval.** Follow this loop exactly. Your work is being traced.

## The loop (mandatory)

1. **Pick one task** from `.planning/TASK-REGISTRY.xml` (status=planned)
2. **Mark it in-progress** in TASK-REGISTRY.xml before starting work
3. **Implement it**
4. **Mark it done** in TASK-REGISTRY.xml
5. **Update STATE.xml** -- set `next-action` to describe what comes next
6. **Commit** with a message referencing the task id (e.g. "feat: 01-02 implement reading store")
7. **Repeat** from step 1

## Before you start coding

1. Read `.planning/REQUIREMENTS.xml` -- the full feature spec (51 success criteria)
2. Read `.planning/DECISIONS.xml` -- architectural decisions you should follow
3. Read `.planning/CONVENTIONS.md` -- coding patterns to adhere to
4. Read `.planning/ROADMAP.xml` -- the 12-phase implementation plan
5. Plan your first phase in `.planning/TASK-REGISTRY.xml`
6. Update `.planning/STATE.xml` with current-phase and status

## Per-task checklist (MANDATORY before next task)

- [ ] TASK-REGISTRY.xml: previous task marked `done`
- [ ] STATE.xml: `next-action` updated
- [ ] Code works (build/lint/test as applicable)
- [ ] Committed with task id in message

## After first implementation phase

Create `.planning/CONVENTIONS.md` additions documenting any NEW patterns you established
beyond what was already documented.

## Decisions during work

Capture any new architectural choices in `.planning/DECISIONS.xml`:
```xml
<decision id="impl-01">
  <title>Short title</title>
  <summary>What and why</summary>
  <impact>How this affects future work</impact>
</decision>
```

## Key architecture notes

- **React package structure:** This is a library, not an app. Export components and stores
  from a public index.ts with sub-path export (`./reader`).
- **Zustand stores:** Always use persist + immer for persisted stores. Include legacy
  key migration in the custom storage adapter.
- **UI primitives:** Build your own lightweight Button, Card, Badge, etc. Do NOT install
  shadcn/ui -- create minimal equivalents.
- **Chrome theme:** All styling flows through a single theme object mapping slot names to
  Tailwind class strings.
- **Annotations:** Three persistence layers merge (IndexedDB local, EPUB embedded, remote
  adapter). Conflict resolution is last-write-wins by timestamp.
- **EpubViewer:** Lazy-loaded. Custom sepia theme. Supports paginated and scrolled modes.

## What NOT to do

- Do NOT skip TASK-REGISTRY.xml updates -- your trace depends on them
- Do NOT batch all planning updates at the end -- update PER TASK
- Do NOT code without planning first
- Do NOT import from shadcn/ui or Radix -- build lightweight primitives
- Do NOT copy code from any external source -- implement from the requirements spec
- Do NOT create files outside the standard artifact set without reason

## Scoring

Your work is scored on:
1. **Requirement coverage** (40%) -- how many of the 51 success criteria are met
2. **Architecture alignment** (25%) -- do your decisions match the reference decisions
3. **State hygiene** (20%) -- per-task updates, task-id commits, STATE.xml accuracy
4. **Convention adherence** (15%) -- file naming, store patterns, import patterns


## REQUIREMENTS.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<requirements>
  <goal>A browser-based EPUB reader workspace with library shelf, annotations, reading progress, and planning integration — shipped as a reusable React package.</goal>
  <audience>Portfolio visitors reading built-in EPUB editions, and workspace owners who import/upload personal EPUBs with persistent progress and highlights.</audience>

  <success-criteria>
    <!-- EPUB rendering -->
    <criterion id="sc-01">Render EPUB files from both remote URL and local ArrayBuffer sources using the react-reader library.</criterion>
    <criterion id="sc-02">Support paginated (book-like spread) and scrolled-doc flow modes, toggled by a preferPagedReader setting.</criterion>
    <criterion id="sc-03">Automatically switch between single-page and two-page spread layout based on viewport width (threshold ~1050px).</criterion>
    <criterion id="sc-04">Apply a custom sepia-toned reader theme with serif typography to EPUB content frames.</criterion>
    <criterion id="sc-05">Display a Table of Contents panel that slides in from the left with animated transitions (framer-motion), showing nested TOC items.</criterion>
    <criterion id="sc-06">Show current section label, page number, and total pages in a bottom navigation bar.</criterion>
    <criterion id="sc-07">Provide prev/next page navigation buttons and direct page-number jump input.</criterion>
    <criterion id="sc-08">Calculate reading progress as a percentage from EPUB location data (CFI-based).</criterion>
    <criterion id="sc-09">Restore reading position on return — persist last location per book using a storage key.</criterion>
    <criterion id="sc-10">Support deep-linking to a specific EPUB location via URL search params (book, record, at, cfi).</criterion>

    <!-- Library / shelf -->
    <criterion id="sc-11">Display a library shelf view with book cards in a responsive grid (2-col on sm, 3-col on xl).</criterion>
    <criterion id="sc-12">Each shelf card shows cover image (or generated empty cover with initials), title, author, genres, description, and reading status badge.</criterion>
    <criterion id="sc-13">Reading status badges resolve to New, N% progress, Done, or Coming Soon based on stored progress.</criterion>
    <criterion id="sc-14">Partition shelf into built-in books (with EPUBs), queued books (no EPUB yet), and uploaded library books.</criterion>
    <criterion id="sc-15">Filter the shelf by genre chips (All + distinct genres extracted from book entries).</criterion>
    <criterion id="sc-16">Filter the shelf by free-text search across title, slug, author, description, and genres.</criterion>
    <criterion id="sc-17">Drag-and-drop EPUB files onto the library view to import them.</criterion>
    <criterion id="sc-18">Import EPUB via file picker button, validating .epub extension.</criterion>
    <criterion id="sc-19">Format uploaded file name into a display title (strip extension, replace separators with spaces).</criterion>

    <!-- Sidebar navigation -->
    <criterion id="sc-20">Render a collapsible sidebar rail on desktop (expanded: 15.5rem, collapsed: 4.25rem) with animated width transition.</criterion>
    <criterion id="sc-21">Show a slide-over mobile drawer on viewports below md, with backdrop overlay and body scroll lock.</criterion>
    <criterion id="sc-22">Sidebar shows Library link, Now Reading indicator when a book is open, and optional host-provided nav links with contextual icons.</criterion>
    <criterion id="sc-23">Sidebar collapse/expand state persists in localStorage via a zustand store.</criterion>

    <!-- Annotations and highlights -->
    <criterion id="sc-24">Allow text selection in the EPUB to create highlights with amber overlay styling.</criterion>
    <criterion id="sc-25">Show a floating selection toolbar with Add Highlight and Dismiss actions when text is selected.</criterion>
    <criterion id="sc-26">Display a Notes and Highlights side panel (slides from right) listing all annotations with quoted text and editable note fields.</criterion>
    <criterion id="sc-27">Support Go To navigation (jump to annotation CFI) and Remove for each annotation.</criterion>
    <criterion id="sc-28">Export annotations as a JSON file following the portfolio-epub-annotations schema.</criterion>
    <criterion id="sc-29">Import annotations from a JSON file and re-apply highlights to the rendition.</criterion>
    <criterion id="sc-30">Download an annotated EPUB with annotations embedded in META-INF/portfolio-annotations.json.</criterion>
    <criterion id="sc-31">Persist annotations locally in IndexedDB keyed by storageKey + contentHash (SHA-256 of EPUB bytes).</criterion>
    <criterion id="sc-32">Merge local, embedded, and remote annotations using last-write-wins by updatedAt timestamp.</criterion>

    <!-- Persistence -->
    <criterion id="sc-33">Track reading progress and location in a zustand store persisted to localStorage as a single JSON blob (portfolio-reader-epub-reading).</criterion>
    <criterion id="sc-34">Migrate legacy per-book localStorage keys (epub-location-*, epub-progress-*) into the consolidated store on first access.</criterion>
    <criterion id="sc-35">Cross-tab synchronization — rehydrate the reading store when the storage event fires for the store key.</criterion>
    <criterion id="sc-36">Support an optional ReaderPersistenceAdapter for remote save/load of location, progress, and annotations.</criterion>
    <criterion id="sc-37">Debounce remote persistence writes by 500ms to avoid excessive API calls.</criterion>

    <!-- Workspace settings and access -->
    <criterion id="sc-38">Owner workspace mode with access state controlling canPersist, canEdit, canUpload permissions.</criterion>
    <criterion id="sc-39">Workspace settings panel (default view, prefer paged reader, show progress badges) persisted via host callback.</criterion>
    <criterion id="sc-40">Continue-reading mode: when defaultWorkspaceView is continue-reading, auto-select the first book with saved progress on load.</criterion>
    <criterion id="sc-41">Explicit upload panel for saving an imported EPUB to the backend library with title, author, description, visibility fields.</criterion>
    <criterion id="sc-42">Upload requires explicit action — importing does not auto-upload; a separate Upload to Library flow is gated by canUpload.</criterion>

    <!-- Modal system -->
    <criterion id="sc-43">Planning cockpit modal rendered as a full-screen overlay with backdrop blur, managed by a dedicated zustand store.</criterion>
    <criterion id="sc-44">Modal accepts a host-provided renderPlanningCockpit render function and a ReaderPlanningCockpitPayload.</criterion>

    <!-- Planning strip -->
    <criterion id="sc-45">Collapsible planning strip bar between header and content area, showing Planning and Planning Cockpit buttons.</criterion>
    <criterion id="sc-46">Expandable quick-links row within the planning strip using animated height transition.</criterion>

    <!-- Planning pack extraction -->
    <criterion id="sc-47">Extract planning packs from EPUB files by reading a planning-pack manifest or falling back to plan-*.xhtml files.</criterion>
    <criterion id="sc-48">Parse XHTML content into plain text for planning pack files, stripping HTML tags and decoding entities.</criterion>

    <!-- Lazy loading -->
    <criterion id="sc-49">Lazy-load the EpubViewer component using React.lazy with a Suspense fallback showing a loading spinner.</criterion>

    <!-- EPUB download -->
    <criterion id="sc-50">Provide a Download EPUB button for built-in books, constructing the download URL from slug or remoteEpubUrl.</criterion>

    <!-- Chrome theming -->
    <criterion id="sc-51">All workspace chrome uses semantic Tailwind/shadcn tokens (bg-background, border-border, text-foreground) — no separate light/dark palettes.</criterion>
  </success-criteria>

  <non-goals>
    <item>The reader does NOT include a full CMS or book authoring interface — it is read-only with import.</item>
    <item>The reader does NOT handle EPUB building/compilation — that is the repub-builder CLI concern.</item>
    <item>The reader does NOT implement authentication — it accepts access state from the host.</item>
    <item>The reader does NOT render non-EPUB formats (PDF, MOBI, etc.).</item>
  </non-goals>

  <core-systems>
    <system id="epub-viewer">EPUB rendering engine wrapping react-reader (epubjs). Handles book loading (URL fetch or ArrayBuffer), rendition configuration (theme, flow, spread), location tracking, TOC extraction, page calculation, and text selection events. Provides prev/next navigation and page jump.</system>
    <system id="workspace-shell">Top-level workspace layout orchestrating the sidebar, header toolbar, planning strip, content area, and modal root. Manages EPUB import (file picker + drag-drop), workspace state resolution, and child component composition.</system>
    <system id="library-shelf">Library view with searchable, filterable book card grid. Partitions books by source kind and EPUB availability. Each card shows metadata, cover, status badge, and action controls. Cards link to the reader view for that book.</system>
    <system id="sidebar-nav">Collapsible navigation rail with desktop aside and mobile slide-over drawer. Shows brand header, Library link, Now Reading section, and host-injected navigation links. Collapse state persisted in a UI store.</system>
    <system id="annotations-engine">Highlight and note system. Creates highlights from text selections on the EPUB rendition. Persists to IndexedDB keyed by book+hash. Supports JSON import/export and embedding annotations inside EPUB ZIP archives. Merges annotations from multiple sources (local, embedded, remote) using timestamp-based conflict resolution.</system>
    <system id="reading-store">Zustand store (persist + immer middleware) tracking per-book reading progress (0-1 float) and last CFI location. Single localStorage JSON blob with legacy key migration. Cross-tab sync via storage event listener.</system>
    <system id="workspace-ui-store">Zustand store persisting sidebar expanded state and shelf genre filter. Includes legacy key migration from older localStorage formats.</system>
    <system id="persistence-adapter">Adapter interface for optional remote persistence. Accepts loadState/saveState with storageKey + contentHash. Merges remote state with local on hydration. Debounced writes.</system>
    <system id="modal-system">Zustand store for planning cockpit modal (open/close + payload). ReaderModalRoot renders the overlay with host-provided content function.</system>
    <system id="planning-integration">Planning strip with quick-links and cockpit button. Planning pack extraction from EPUB archives. Host-configurable per-book planning payload.</system>
    <system id="ui-primitives">Lightweight UI primitives (Button, Card, Badge, Input, Select, Textarea, Checkbox) with variant/size props and a minimal cn() class merge utility. Not shadcn/ui directly — custom implementations matching shadcn conventions.</system>
    <system id="chrome-theme">Single object mapping semantic slot names to Tailwind class strings. All workspace components reference this map for consistent theming.</system>
    <system id="route-builder">Utility function constructing reader URLs from a base path and optional search params (book, record, at, cfi).</system>
  </core-systems>

  <stack>
    <item>React 19 — component UI and hooks for state/effects</item>
    <item>TypeScript — strict typing for all modules, exported type definitions for host integration</item>
    <item>react-reader v2 (epubjs wrapper) — EPUB rendering, TOC, location management, rendition API</item>
    <item>zustand v5 with persist + immer middleware — client-side state management with localStorage persistence</item>
    <item>framer-motion — animated transitions for TOC panel, notes panel, and planning strip</item>
    <item>lucide-react — icon library for all UI icons</item>
    <item>jszip — reading/writing ZIP archives for annotation embedding and planning pack extraction</item>
    <item>Tailwind CSS — utility-first styling with shadcn semantic token conventions</item>
    <item>tsup — build tooling for the package (ESM output)</item>
    <item>vitest — test runner</item>
  </stack>
</requirements>
```

## REQUIREMENTS.md (eval overview)

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

## Notes

- The eval template provides REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml,
  and STATE.xml -- the agent builds from these alone
- No source code from the reference implementation is included
- The agent must create a functional React package, not just planning docs
- Planning pack extraction (phase 11) depends on a planning-pack-manifest module that
  may need to be stubbed or simplified in the eval context
- The agent should install react-reader, zustand, framer-motion, lucide-react, and jszip
  as real dependencies


## DECISIONS.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <decision id="re-01">
    <title>react-reader (epubjs) as EPUB rendering engine</title>
    <summary>The project uses react-reader v2 which wraps epubjs. This provides EPUB parsing, CFI-based location tracking, rendition theming, TOC extraction, text selection events, and paginated/scrolled flow modes out of the box. The EpubViewer component customizes ReactReader's styles extensively and hooks into the rendition API for spread control, theme registration, and annotation highlighting.</summary>
    <impact>Re-implementation must use react-reader or an equivalent epubjs wrapper. The rendition API (flow, spread, themes, book.locations, annotations) is deeply relied upon. Custom theme rules are injected via rendition.themes.register().</impact>
  </decision>

  <decision id="re-02">
    <title>Zustand with persist + immer for all client stores</title>
    <summary>Three zustand stores are used: (1) reader-reading-store for per-book progress/location, (2) reader-workspace-ui-store for sidebar state and shelf filter, (3) reader-modal-store for planning cockpit modal. All persisted stores use zustand/middleware/persist with createJSONStorage wrapping localStorage, and zustand/middleware/immer for immutable draft updates. Each persisted store includes a custom storage adapter that handles legacy key migration on first access.</summary>
    <impact>State management must follow the zustand + immer + persist pattern. Legacy migration logic must be preserved during re-implementation. The reading store additionally listens to the window storage event for cross-tab sync.</impact>
  </decision>

  <decision id="re-03">
    <title>IndexedDB for annotation persistence, localStorage for reading progress</title>
    <summary>Annotations are stored in IndexedDB (database: portfolio-reader-v1, store: epub-annotations) keyed by storageKey::contentSha256. Reading progress and location are in localStorage via the zustand reading store. This split exists because annotations can be large (many highlights with quotes/notes) while progress is a single number + CFI string per book. The content hash uses SHA-256 via crypto.subtle.digest to detect EPUB content changes.</summary>
    <impact>Two distinct persistence layers must be implemented. The IndexedDB schema is simple (single object store, compound string key). Content hashing normalizes the EPUB by stripping the portfolio-annotations.json file before hashing to ensure annotation changes don't invalidate the hash.</impact>
  </decision>

  <decision id="re-04">
    <title>Package exports the reader as a composable sub-path</title>
    <summary>The package.json defines dual exports: "." for the builder and "./reader" for the reader workspace. The reader index.ts re-exports all public components, stores, types, and utilities. This allows the host app to import from @portfolio/repub-builder/reader without pulling in build-time dependencies.</summary>
    <impact>Re-implementation must maintain the sub-path export structure. All public API surface (components, stores, types, utilities) must be exported from the reader index.</impact>
  </decision>

  <decision id="re-05">
    <title>Host-injected link component for framework-agnostic routing</title>
    <summary>The workspace accepts a ReaderLink component prop (defaults to a plain anchor tag). This allows Next.js hosts to pass their Link component for client-side navigation without the reader package depending on next/link. The ReaderLinkComponent type extends AnchorHTMLAttributes with a required href.</summary>
    <impact>All internal navigation must use the injected ReaderLink, never hardcoded anchor tags or framework-specific routing. The default-reader-link.tsx provides the fallback.</impact>
  </decision>

  <decision id="re-06">
    <title>Discriminated union for workspace state</title>
    <summary>ReaderWorkspaceState is a discriminated union of three modes: library (no book selected), built-in-reading (remote EPUB URL), and local-reading (imported ArrayBuffer). The resolveReaderWorkspaceState function derives the current mode from initialBook and uploadedBook props. Each mode has specific fields (viewerSource, canDownload, localFileName) typed per variant.</summary>
    <impact>The workspace state derivation is a pure function — re-implementation should maintain this pattern. The viewer source discriminant (kind: built-in vs local) determines how the EPUB is loaded.</impact>
  </decision>

  <decision id="re-07">
    <title>Custom UI primitives instead of full shadcn/ui</title>
    <summary>The reader ships its own lightweight UI primitives (Button, Card, Badge, Input, Select, Textarea, Checkbox) in a ui/ subdirectory. These follow shadcn conventions (variant/size props, semantic class tokens) but are simplified implementations without Radix UI dependencies. A minimal cn() utility joins class strings without clsx/tailwind-merge.</summary>
    <impact>Re-implementation should create equivalent lightweight primitives. Do not import from a host shadcn/ui installation — the reader package must be self-contained.</impact>
  </decision>

  <decision id="re-08">
    <title>Chrome theme as a single class-map object</title>
    <summary>All reader workspace styling is centralized in reader-chrome-theme.ts as a const object mapping semantic slot names (shell, headerBar, title, pillButton, etc.) to Tailwind class strings. Components import readerChromeClasses and use the slots. The code comment notes a former ember/ink palette toggle was removed in favor of always following the site theme via CSS custom properties.</summary>
    <impact>The theme must be a single source-of-truth object. Components must not hardcode theme classes — they reference the chrome map.</impact>
  </decision>

  <decision id="re-09">
    <title>Annotation merge strategy: last-write-wins by timestamp</title>
    <summary>The mergePersistedAnnotations function merges annotations from multiple sources by ID. When the same annotation ID appears in multiple sources, the one with the latest updatedAt (or createdAt) timestamp wins. The merge order is: remote annotations first, then local annotations override. The result is sorted by timestamp.</summary>
    <impact>The merge algorithm must be deterministic and handle all three annotation sources (embedded in EPUB, IndexedDB local, remote adapter). Conflict resolution is purely timestamp-based.</impact>
  </decision>

  <decision id="re-10">
    <title>Lazy-loaded EpubViewer via React.lazy + Suspense</title>
    <summary>EpubViewerLazy.tsx wraps the real EpubViewer in React.lazy() with a Suspense fallback. The workspace imports from EpubViewerLazy, not EpubViewer directly. This keeps the react-reader + epubjs bundle out of the initial chunk.</summary>
    <impact>The EPUB rendering code must be code-split. The loading fallback shows a spinner with "Loading book..." text.</impact>
  </decision>

  <decision id="re-11">
    <title>Persistence adapter as an optional interface, not a required dependency</title>
    <summary>ReaderPersistenceAdapter is an interface with loadState/saveState methods. It is optional (null by default). When provided, remote state is merged with local on hydration, and writes are debounced. Only built-in source books use the remote adapter — uploaded/local books persist only locally.</summary>
    <impact>The reader must function fully offline with no persistence adapter. Remote persistence is an enhancement, not a requirement.</impact>
  </decision>

  <decision id="re-12">
    <title>Planning pack extraction from EPUB ZIP structure</title>
    <summary>The planning-pack-from-epub module reads a planning pack manifest from the EPUB ZIP, or falls back to discovering plan-*.xhtml files in OEBPS/. It extracts XHTML content, strips HTML to plain text, and returns a structured pack with virtual file paths. This enables the host to display planning documentation embedded within EPUB artifacts.</summary>
    <impact>Planning pack extraction is a standalone utility. It depends on jszip and the planning-pack-manifest module from the parent package. Re-implementation must handle both manifest-driven and fallback discovery paths.</impact>
  </decision>
</decisions>
```

## CONVENTIONS.md

# Conventions — Reader Workspace

## File naming

- **React components:** PascalCase files (`ReaderWorkspace.tsx`, `EpubViewer.tsx`, `ReaderShelfCard.tsx`)
- **Modules/stores/utilities:** kebab-case files (`reader-reading-store.ts`, `reader-chrome-theme.ts`, `epub-annotations.ts`)
- **Types:** single `types.ts` file at the module root for shared type definitions
- **UI primitives:** flat directory `ui/` with one file per primitive (`button.tsx`, `card.tsx`, `badge.tsx`)
- **Lazy wrappers:** `ComponentLazy.tsx` naming pattern (e.g., `EpubViewerLazy.tsx`)

## Component patterns

- All client components begin with the `'use client'` directive
- Components are exported as named exports, except the main workspace and EpubViewer which use `export default`
- Props are defined as inline type literals or exported type aliases (e.g., `ReaderWorkspaceProps`, `EpubViewerProps`)
- Components accept a `className` prop for external styling when appropriate
- Conditional rendering uses ternary with `null` return: `{condition ? <Component /> : null}`
- No `&&` short-circuit rendering — always explicit ternary

## Store patterns

- All zustand stores use `create<StateType>()(persist(immer(...), {...}))` — always persist + immer together for persisted stores
- Non-persisted stores (modal store) use `create<StateType>()(immer(...))`
- Store names follow the pattern: `portfolio-reader-<purpose>` (e.g., `portfolio-reader-epub-reading`)
- Each persisted store includes a `partialize` function to select only the data fields (not actions)
- Legacy migration is handled in a custom storage adapter's `getItem` — reads old keys, consolidates, removes them
- A `noopStorage()` factory provides SSR-safe storage fallback
- Stores export a `use<Name>Store` hook (e.g., `useReaderReadingStore`)
- Non-hook access uses `useStore.getState()` for imperative reads/writes outside React

## Type conventions

- Types use the `type` keyword (not `interface`) for all data shapes
- Discriminated unions for state variants: `{ mode: 'library' } | { mode: 'built-in-reading' } | { mode: 'local-reading' }`
- Source kind uses string literal unions: `'built-in' | 'uploaded' | 'local'`
- Nullable fields use `string | null` (not optional `?:`) when the field is always present but may be null
- Optional fields use `?:` when the field may be entirely absent
- Status types are union objects with a `kind` discriminant: `{ kind: 'new'; label: 'New'; progress: 0 }`

## Import patterns

- React imports: `import React, { useCallback, useEffect, ... } from 'react'`
- Icons: individual named imports from `lucide-react` (`import { BookOpen, ChevronLeft } from 'lucide-react'`)
- Internal imports: relative paths with `./` prefix, no barrel re-imports within the module
- Type-only imports: `import type { ... }` for pure type references
- UI primitives: `import { Button } from './ui/button'`
- The public `index.ts` re-exports everything — consumers import from the package path, not internal paths

## Styling patterns

- Tailwind utility classes everywhere, no CSS modules or CSS-in-JS
- Semantic tokens from shadcn convention: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`
- Chrome theme object provides class strings per slot — components use `const t = readerChrome` and apply `t.pillButton`, `t.shell`, etc.
- Rounded corners: `rounded-full` for pill buttons, `rounded-2xl` for cards and panels, `rounded-[2rem]` for the main content inset
- Responsive prefixes: `md:` for desktop overrides, `sm:` for tablet grid, `xl:` for wide grid
- Transition utilities: `transition-colors`, `transition-[width]`, `transition-opacity`
- The `cn()` utility is a minimal string joiner (no tailwind-merge) — just filters falsy values and joins with space

## Animation patterns

- framer-motion `AnimatePresence` wraps conditionally rendered panels (TOC, notes, planning strip links)
- Consistent transition config: `duration: 0.24, ease: [0.22, 1, 0.36, 1]` for slide-in panels
- Panels animate x-offset + opacity (left panels: x: -28 to 0; right panels: x: 28 to 0)
- Height-based collapse: `initial={{ height: 0, opacity: 0 }}` for expandable rows

## Error handling

- Empty catch blocks with `/* ignore */` comments for non-critical failures (quota errors, private mode)
- Graceful degradation: if IndexedDB is unavailable, return empty arrays; if localStorage fails, use noop storage
- EPUB fetch errors shown inline in the viewer area, not thrown
- AbortController for EPUB URL fetches with cleanup on unmount

## Testing

- Test files co-located with source: `epub-annotations.test.ts`, `reader-ui-primitives.test.ts`
- Uses vitest as the test runner


## ROADMAP.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="01">
    <title>Foundation: types, utilities, and build scaffold</title>
    <goal>Set up the package structure with tsup build, define all shared types (ReaderBookEntry, ReaderWorkspaceAccessState, ReaderWorkspaceSettingsState, etc.), create the cn() utility and route builder, and establish the ui/ primitives directory with Button, Card, Badge, Input, Select, Textarea, Checkbox.</goal>
    <status>planned</status>
  </phase>

  <phase id="02">
    <title>Chrome theme and empty cover</title>
    <goal>Implement the readerChromeClasses theme object with all semantic slots. Create ReaderEmptyCover component that generates initials from a book title.</goal>
    <status>planned</status>
  </phase>

  <phase id="03">
    <title>Reading stores and progress tracking</title>
    <goal>Build the zustand reading store (reader-reading-store) with persist + immer + legacy migration. Implement reader-progress module with progress/location read/write functions and shelf status resolution. Build reader-storage-keys constants. Add cross-tab sync via storage event.</goal>
    <status>planned</status>
  </phase>

  <phase id="04">
    <title>Workspace UI store and shelf catalog</title>
    <goal>Build the workspace UI store (sidebar expanded, shelf filter with genre clamping, legacy migration). Implement reader-shelf-catalog with genre extraction, book partitioning, and genre-based filtering.</goal>
    <status>planned</status>
  </phase>

  <phase id="05">
    <title>Annotations engine</title>
    <goal>Implement epub-annotations module: PortfolioAnnotation type, IndexedDB persistence (open, load, save), SHA-256 content hashing with annotation-file normalization, JSON export/import (parseAnnotationsFile, serializeAnnotationsExport), and EPUB embedding/extraction using jszip. Implement reader-persistence module with mergePersistedAnnotations and the ReaderPersistenceAdapter interface.</goal>
    <status>planned</status>
  </phase>

  <phase id="06">
    <title>EpubViewer component</title>
    <goal>Build the core EpubViewer wrapping ReactReader. Handle URL fetch and ArrayBuffer loading, custom sepia reader theme registration, paginated/scrolled flow + spread control, TOC extraction and section label resolution, page calculation, location persistence, annotation hydration (merge local + embedded + remote), highlight rendering, text selection for new highlights, notes panel UI, annotation import/export/download actions, bottom navigation bar with page jump, and the lazy-loading wrapper (EpubViewerLazy).</goal>
    <status>planned</status>
  </phase>

  <phase id="07">
    <title>Workspace state and shelf card</title>
    <goal>Implement reader-workspace-state with the discriminated union resolver (library / built-in-reading / local-reading), storage key derivation, and the UploadedBookSource type. Build ReaderShelfCard with cover, status badge, genre chips, hover action cluster, and planning cockpit trigger.</goal>
    <status>planned</status>
  </phase>

  <phase id="08">
    <title>Sidebar navigation</title>
    <goal>Build ReaderWorkspaceSidebar with desktop rail (collapsible), mobile drawer (slide-over with backdrop), nav sections (Library, Now Reading, extra links with contextual icons), brand header, and collapse toggle button.</goal>
    <status>planned</status>
  </phase>

  <phase id="09">
    <title>Modal system and planning strip</title>
    <goal>Build reader-modal-store (zustand + immer, non-persisted). Build ReaderModalRoot overlay component with backdrop blur and host-rendered cockpit content. Build ReaderPlanningStrip with toggle button and animated quick-links row.</goal>
    <status>planned</status>
  </phase>

  <phase id="10">
    <title>ReaderWorkspace orchestration</title>
    <goal>Build the main ReaderWorkspace component that composes all subsystems: sidebar, header toolbar (with import/upload/settings/download buttons), planning strip, content area (viewer or library shelf), shelf search and genre filter chips, EPUB drag-and-drop import, upload panel, settings panel, workspace access display, and modal root. Wire all state flows between subsystems.</goal>
    <status>planned</status>
  </phase>

  <phase id="11">
    <title>Planning pack extraction</title>
    <goal>Implement planning-pack-from-epub module: manifest-driven extraction, plan-*.xhtml fallback discovery, XHTML-to-plaintext conversion (tag stripping, entity decoding), virtual path resolution. Create readerBookPlanningPackId utility.</goal>
    <status>planned</status>
  </phase>

  <phase id="12">
    <title>Public API and package exports</title>
    <goal>Wire up index.ts with all public re-exports. Verify sub-path export (./reader) works. Ensure all types, components, stores, and utilities are accessible to host apps. Add default-reader-link fallback component.</goal>
    <status>planned</status>
  </phase>
</roadmap>
```

## STATE.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase></current-phase>
  <current-plan></current-plan>
  <milestone>M1: Reader Workspace</milestone>
  <status>not-started</status>
  <next-action>Read REQUIREMENTS.xml and begin planning phase 01 (Foundation: types, utilities, build scaffold).</next-action>
  <last-updated></last-updated>
</state>
```


## Instructions


1. Copy the .planning/ directory from the template into your working directory

2. Implement the project following the ROADMAP.xml phases

3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID

4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture

5. When complete: all phases done, build passes, planning docs current