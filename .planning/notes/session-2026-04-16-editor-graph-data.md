# Session 2026-04-16: Project Editor + Graph + Data Architecture

## What shipped (18 commits)

### Project Editor (phase 44.5)
- Route `/projects/edit/[id]` with dev gate, three-pane layout, collapsible panels
- DNA Editor: 91 genes loaded via /api/dev/gene-states, action rows per state (Show/Promote/Validate/Shed/Cleanup)
- Bestiary tab: species cards with generation timeline dots
- Recipes tab: species template config cards
- Inventory grid: Minecraft-style key-value editor for JSON objects
- Inspector: project/species/generation detail with scoring weights, constraints
- TraitBar: animated color-coded horizontal bars for scores
- RadarChart: SVG spider chart with multi-series overlay
- DiffTree: JSON diff with green/red/amber highlighting
- Command palette (Cmd+K): gene lifecycle commands with autocomplete
- "Open in Editor" CTA on listing pages, project index at /projects/edit
- Display name fix: resolves human name from project.json
- Canvas layout fix: stripped SiteSection wrappers from iframes, both panes auto-collapse

### Graph system (42.2-45/47/48)
- `lib/graph-extractor.cjs`: 500 LOC, zero deps, 829 nodes, 1142 edges
- `gad graph build` (~320ms) + `gad query` (~260ms)
- 12.9x token savings verified (1770 → 137 tokens, same data)
- 10/10 test suite in tests/graph-extractor.test.cjs
- Interactive HTML viz in editor Graph tab
- Feature flag: useGraphQuery in gad-config.toml, isGraphQueryEnabled() for fallback
- Auto-rebuild via file watcher (500ms debounce after .planning/ changes)

### Infrastructure
- Scoped command bridge /api/dev/command-bridge (allowlisted gad subcommands)
- Live planning data SSE /api/dev/live (file watcher + agent presence detection)
- Graph serve route /api/dev/graph (?projectid=X, ?format=json, ?rebuild=1)
- Gene states route /api/dev/gene-states
- pdf-parse installed for PDF text extraction

### Subagent work
- Graph query wired as default: snapshot task listing, 5 skills updated, AGENTS.md, gad-loop.md, consumer install
- Reverse-engineer skill: 4-tier extraction pipeline (native → pdf → graphify → manual)
- Workflow swap: task-checkpoint references gad query first

## Decisions captured
- gad-199/200: graph + post-shed cleanup (early session, partially superseded)
- gad-201: graph query as default for all GAD projects (subagent)
- gad-202: all workflows prefer gad query over raw XML (subagent)
- gad-203: filesystem-as-database with eval-data-access.cjs unified module
- gad-204: Graphify is shelfware, native extractor is production
- gad-205: multi-tenant platform vision, local-first data model

## Open for next session

### Priority 1: Data layer (gad-203)
- Build `lib/eval-data-access.cjs` — unified CRUD module for projects/species/generations
- Build `/api/dev/evals/` REST routes (projects, species, generations, query)
- Rewire editor from generated TS imports to runtime API calls
- Add `gad projects create/edit/archive` and `gad species create/edit/clone/archive` CLI commands
- Add eval-project/eval-species/eval-run nodes to graph
- Separate DB viewer into framework-research vs project-operational collections

### Priority 2: Editor polish
- Remaining 44.5 tasks: 01b (draft/published), 01d (skills scope), 02b (bridge hardening), 03 (file-system adapter — now part of data layer), 09 (already built as DiffTree)
- Species creation from UI (needs data layer first)
- Generation launch from UI (needs data layer first)

### Priority 3: Platform prep
- User model schema design
- Per-project repo integration (GitHub API)
- Agent session management for hosted mode
- WhatsApp/messaging integration design
- Billing model (per-run token metering)

## Key files
- `site/app/projects/edit/[id]/` — all editor components (15 files)
- `site/app/api/dev/` — command-bridge, gene-states, graph, live (4 routes)
- `lib/graph-extractor.cjs` — graph builder + query engine
- `tests/graph-extractor.test.cjs` — 10 tests
- `.planning/gad-config.toml` — feature flags including useGraphQuery
