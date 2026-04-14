---
status: candidate
source_phase: "22"
source_phase_title: "Portfolio experiment documentation — hub, per-project, per-run, findings, graphs"
pressure_score: 110
tasks_total: 58
tasks_done: 46
crosscuts: 26
created_on: "2026-04-14"
created_by: compute-self-eval
---

# Candidate from phase 22

## Phase

```
get-anything-done | 22 | Portfolio experiment documentation — hub, per-project, per-run, findings, graphs
selection pressure: 110  (58 tasks, 46 done, 26 crosscuts)
```

## Tasks

```
22-01 done Plan the portfolio experiment documentation structure â€” pivoted to a standalone Next.js site at vendor/get-anything-done/site/ instead of apps/portfolio docs. Designed single-page sections (workflow, rounds, projects, results, playable, requirements, catalog, templates) plus dynamic per-run pages.
22-02 done Hub/home page explaining the experiment, freedom hypothesis, methodology, and linking to every section.
22-03 done Per-eval-project cards for all six projects with greenfield/brownfield split.
22-04 done Per-run detail pages for every eval run with TRACE.json breakdown, dimension scores, gate report, process metrics, playable link.
22-05 done Per-round experiment summary sections that compare conditions.
22-06 cancelled Visualizations/graphs across rounds. Deferred â€” score bars on the per-run page and run cards cover the "at a glance" comparison for now; a dedicated charts section can be revived later if we decide we're missing the signal.
22-07 done Requirements version history (v1 â†’ v4 lineage with diffs).
22-08 cancelled Decisions index page. Deferred â€” decisions referenced inline in Rounds and Requirements sections; full decisions index can be a dedicated /decisions route later when the list is big enough to warrant it.
22-09 done Findings as standalone pages: /findings index + /findings/[slug] per finding.
22-10 done Build pipeline so the site data stays in sync with the repo.
22-11 done Extract v1 and v2 REQUIREMENTS.md snapshots from git history.
22-12 done Markdown rendering via marked in prebuild.
22-13 done Per-skill detail pages app/skills/[id]/page.tsx.
22-14 done Per-agent detail pages app/agents/[id]/page.tsx.
22-15 done Per-command detail pages app/commands/[id]/page.tsx.
22-16 done Findings routes at /findings and /findings/[slug].
22-17 done Framework vs eval-inherited catalog split.
22-18 done /planning meta-transparency page.
22-19 done skills/portfolio-sync/SKILL.md â€” methodology for keeping the public site in sync with evals.
22-20 done Dedicated /gad framework overview page. Currently the home Loop + Catalog sections are entry points but there is no standalone "what is GAD" reference page someone can deep-link to. The catalog cards work but users have asked for a top-level GAD explainer + index that links into skills/agents/commands as a single navigation hub.
22-21 done /methodology page that explains how tracing works, what fields TRACE.json captures, all scoring formulas per eval project (pulled from evals/&lt;project&gt;/gad.json), the low-score caps from v3, and the gate logic. This is the "how we measure" appendix users have been asking for. Includes concrete worked examples showing how a composite score was derived.
22-22 cancelled Per-run page enhancements: (1) render composite formula as a weighted-sum breakdown showing each dimension's contribution to the composite; (2) when skill_accuracy has expected_triggers array (like v5), render the per-skill trigger table; (3) when skill_accuracy is a bare number (like v8), show a "tracing gap" callout noting the run didn't capture per-skill detail and link to phase 25 (trace schema overhaul).
22-23 done Per-project detail pages at /projects/[id]. Shows: project description + mode + workflow, the catalog scope for that project (framework GAD = full catalog, bare = 2 bootstrap skills, emergent = 2 bootstrap + inherited), all runs with inline scores, "what the agent built for itself" per run (scan run/.planning/skills/*.md and similar).
22-24 done Lightweight SVG charts in a Graphs section on the home page: composite + human review bars per run grouped by workflow, rounds timeline, freedom hypothesis scatter (composite vs human review divergence). No charting library â€” pure React-rendered SVG so it ships in every prebuild.
22-25 done Nav surface update: add Framework + Methodology + Projects links. Current nav is already packed â€” may need a secondary nav row or drop items.
22-26 cancelled Expose scoring weights per project from evals/&lt;project&gt;/gad.json in the generated data. Every eval project can have different weights; we're currently only reading one set for display. Emit SCORING_WEIGHTS by project so the methodology page and per-run formula display can show the project-specific math.
22-27 cancelled New skill skills/framework-upgrade/SKILL.md. Methodology for versioning the GAD framework on branches (version/v1.x), stamping every TRACE.json with the framework commit it ran against, re-running past evals when the framework changes to check for framework-level score drift. References phase 25 as the backing work.
22-28 done Mark the create-skill inheritance requirement explicit in a DECISION so bare/emergent templates are not accidentally regressed.
22-29 done /lineage page explaining context rot, the GSD upstream, the RepoPlanner predecessor (b2gdevs / https://repo-planner.vercel.app/ â€” first Ralph Wiggum loop formalization), and how GAD combines both approaches plus measurement. Links to both projects' sources. Captures decision gad-56.
22-30 cancelled Agent Runtimes comparison table on /methodology showing which coding agents can produce trace v4 data (Claude Code âœ“ via hooks, Aider âœ“ via Python callbacks, Continue.dev âœ“ via extension API, Cursor âœ—, vanilla Codex CLI âœ— stream-only). Published alongside decision gad-53 explicit note that agents without hook runtimes are unsupported for GAD evaluation.
22-31 done Phase 26 scaffolding: install @remotion/player, create site/remotion/ directory with Root.tsx composition registry + one placeholder Composition.tsx (the v8 dissection stub), create app/videos/page.tsx index with filter, create components/VideoEmbed.tsx inline player wrapper (30s cap, cinematic passthrough, stop button, reuses existing site components as frames). Does NOT author full video content â€” the scaffold establishes the pattern and the first composition is a placeholder.
22-32 done Write .planning/DISCUSS-PHASE-25.md capturing the trace schema v4 discussion output.
22-33 cancelled `gad install` CLI subcommand as a local-checkout-friendly wrapper around existing bin/install.js. The underlying install.js already supports --claude --cursor --codex --opencode --gemini --copilot --antigravity --windsurf --augment --all --uninstall and ships the full GSD-pattern cross-runtime install â€” but it's hardcoded for the npm-published package layout (expects to find files under `node_modules/get-anything-done/get-anything-done/`). This task wraps it in a `gad install` subcommand that resolves paths correctly whether running from a git checkout (vendor/get-anything-done/) or an npm install. Related to 22-34 (fix install.js directly) â€” this task may become a no-op if 22-34 fixes the path resolution at the install.js level.
22-34 done Fix path resolution bug in bin/install.js for local git checkouts.
25-01 done Design trace event envelope + 4 event types as a reusable library in lib/trace-schema.cjs.
25-02 done Write the hook handler script at bin/gad-trace-hook.cjs that Claude Code invokes for PreToolUse/PostToolUse.
25-03 done 4 KB truncation helper with head+tail split for trace event outputs.
25-04 done `gad install hooks` CLI subcommand that wires the trace hook into Claude Code settings.json.
22-35 done Fix YAML parsing errors in session-authored skill frontmatter (create-skill, objective-eval-design). Descriptions with embedded colons like "methodology:" and "discipline:" were parsed by js-yaml as key-value separators, breaking skill loading in Claude Code. Fix by converting plain scalar descriptions to YAML folded block scalar form (`description: &gt;- ...`) which treats the body as opaque.
22-36 done Dogfood-failure recovery: author skills/emergent/session-discipline/SKILL.md as an agent-authored hard-start checklist. Move agent-authored skills into skills/emergent/ so default install can skip them. Add origin + authored-by + authored-on + excluded-from-default-install fields to CatalogSkill. Capture gad-78 (dogfood failure) + gad-79 (task_pressure programmatic) decisions.
22-37 done Reorganize .planning/ root: move ad-hoc markdown docs (ASSUMPTIONS.md, GAPS.md, SKEPTIC.md, SESSION-REFLECTION-*.md) into a new .planning/docs/ subdirectory per user directive. Rationale: .planning/ root should hold the formal XML artifacts that gad snapshot surfaces; ad-hoc human-written docs that are not formal (but still project-relevant) belong in a peer docs/ folder. Update all site page references to the new paths.
22-38 done Retroactively update TASK-REGISTRY.xml to mark 22-20/22-21/22-23/22-24/22-25/22-29 as done (work shipped in prior sessions without registry updates â€” dogfood failure per gad-78). Add new tasks 22-36/22-37/22-38/22-39/22-40/22-41/22-42/22-43 for this session's work.
22-39 done Agent-crawlable documentation export: emit public/llms.txt (concise index per llmstxt.org convention), public/llms-full.txt (full-text dump of skills/decisions/questions/bugs/glossary/tasks/phases/current-requirements), public/api/docs.json (structured JSON with schema gad-docs-v1) at prebuild. Provides a full API reference for external agents evaluating or reviewing GAD without needing to crawl HTML.
22-40 done Interactive chart on /roadmap showing human review across rounds broken out by hypothesis track. Solid lines for tracks with real data (freedom/csh/gad). Dashed ghost lines for planned tracks without runs yet (content-driven, codex runtime) so the research plan is visible.
22-41 done /hypotheses index page + /freedom evidence page + /content-driven planned-hypothesis page. Every hypothesis the project tracks gets wired to its eval track, its latest evidence, and its dedicated evidence page. Status labels: preliminary observation / discussing / operationalized / not-yet-tested.
22-42 done Clickable skills modal on /emergent: convert the static skill-artifact chip list on the emergent page into client-component buttons that open a modal showing the full SKILL.md content with Copy button + GitHub source link. Per user directive 2026-04-09: "I wish i could click and download or get that pop up of those skills on the page."
22-43 done Scaffold evals/gad-explainer-video/ as a new eval project: REQUIREMENTS.md describing the Remotion GAD explainer video task (3-minute explainer, 4 mandatory gate frames, pedagogical clarity as primary rubric dimension), gad.json with workflow:gad + compare_to bare/emergent siblings + rubric weights. Tests freedom/CSH/emergent-evolution hypotheses on a DIFFERENT task domain (video composition instead of game implementation) â€” the generalization test /skeptic says we need.
22-44 cancelled Manual fresh-clone contribution test (open question fresh-clone-contribution-test, decision gad-77). Clone the repo into a new directory, walk through the /contribute 5-step flow (clone â†’ install â†’ open in Claude â†’ talk conversationally), document everything that breaks, update /contribute with the friction points, remove the "fresh-clone test still open" amber warning. Goal: make contribution actually work for a human who has never touched GAD before.
22-45 done Site/remotion/ runtime scaffold (second half of task 22-31): create Root.tsx composition registry, one placeholder Composition.tsx, site/app/videos/page.tsx loading compositions via @remotion/player, VideoEmbed.tsx wrapper component. This unblocks the gad-explainer-video eval project (22-43) being run for the first time.
22-46 done Adopt agentskills.io .agents/skills/ convention (gad-80). Extend bin/install.js to copy skills to BOTH .claude/skills/ (native) AND .agents/skills/ (cross-client) for supported runtimes. Migrate the fundamental triumvirate (create-skill, merge-skill, find-skills per gad-73) to the new location once those skills exist. Required for the codex-vs-claude comparison eval (task 89) because Codex uses different discovery conventions â€” if we target .agents/skills/, both runtimes find the same skills. Also honor the excluded-from-default-install:true frontmatter flag I added to the emergent skill â€” the installer must skip those.
22-47 cancelled Build a /standards page on the site citing both the Anthropic skills guide (resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf) and agentskills.io. Link from /skills, /security, /methodology, /gad. The page must summarize: (a) SKILL.md format + required frontmatter, (b) progressive disclosure three-tier loading, (c) name collision handling, (d) the per-skill evaluation methodology (with_skill vs without_skill baseline per agentskills.io/skill-creation/evaluating-skills). This becomes the reference page every skill-related section of the site cites instead of repeating the content inline.
22-48 done Worktree isolation audit script (gad-82, open question worktree-isolation-verification). Write scripts/audit-worktree-isolation.mjs that walks a fresh eval worktree and reports: which files from the parent repo are reachable (by relative path traversal), what settings from .claude/settings.json inherit, what env vars are set, what's on PATH, which workspace skills at vendor/get-anything-done/skills/ could be picked up by a scan that walks parent dirs. Output structured report. ROUND 5 IS BLOCKED on either passing this audit or documenting which parent-repo state is explicitly allowed (e.g. the trace hook handler is allowed because it's the instrumentation layer per gad-50; workspace skills are NOT allowed because bare condition requires zero framework affordances).
22-49 cancelled Skill collision detection at prebuild (gad-81). Scan every skills/*/SKILL.md description for overlapping trigger keywords. Compute a keyword profile per skill, find overlaps above a threshold, emit a collision report to data/skill-collisions.json. Add a "collision candidates" section to the /skills site page showing any detected overlaps with a merge-skill suggestion link (merge-skill itself not yet built â€” link falls back to a manual-review prompt). Also: a keyword index for every skill so users searching can see what terms trigger each.
22-50 cancelled Extract thinking blocks from session.jsonl into TRACE.json derived.reasoning_trace (gad-84, GAPS G13). Post-hoc offline enrichment â€” no new hooks required. Walk a run's session.jsonl, pull every thinking block and inter-tool message text, attach to TRACE.json with timestamps tying thoughts to subsequent tool uses. First exploratory analysis: thought-to-action interval, thought length distribution, keyword presence (exploration vs execution), thought-before-action vs thought-after-action ordering. This is the highest-leverage way to get "agent reasoning" signal without Claude Code exposing new hook surfaces.
22-51 done Scaffold new eval domain evals/skill-evaluation-app/ per decision gad-88. Third task-domain alongside escape-the-dungeon (game dev) and gad-explainer-video (video composition). Tests the same hypotheses (freedom / CSH / emergent-evolution) on GUI app development. The GUI, once built, is also part of the GAD eval framework (dogfood).
22-52 cancelled Build the GAD-native per-skill evaluation harness: gad eval skill &lt;name&gt; CLI subcommand. Reads evals/evals.json inside the skill directory, spawns clean-context subagent runs (with_skill + without_skill) via gad worktree, captures trace events from v4 schema (gad-50) as the observable signal, grades assertions by querying trace events + file mutations + commit log (NOT LLM self-report â€” that's what skill-creator's Python harness does and it didn't work for us), emits benchmark.json compatible with agentskills.io format. This is the load-bearing piece that lets every GAD skill graduate from experimental to canonical per gad-86. Directly answers programmatic-eval GAPS G2 + the hygiene half of G11.
22-53 done Author merge-skill + find-skills SKILL.md files as workspace skills. find-skills is a thin methodology wrapper around npx skills (vercel-labs/skills CLI per gad-85). merge-skill is a pure methodology doc for fusing overlapping skills. Both start as experimental (status: experimental) because no evaluation harness has been run against them yet.
22-54 done Landing page + /hypotheses interactive chart. User directive 2026-04-09: "the interactive chart I asked for should have been on the front page, but I dont see it... I still see an emergent page, but not a hypothesis page with graphs and etc detailing it out visually." Move or duplicate the HypothesisTracksChart from /roadmap onto the landing page (after Hero, before WhatItIs) and add it to /hypotheses above the hypothesis cards.
```

## What this candidate is for

This file was auto-generated by `compute-self-eval.mjs` because phase
22 exceeded the selection pressure threshold. High pressure
signals a recurring pattern that may want to become a reusable skill.

This is the **raw input** to the drafting step. The drafter (`gad-quick-skill`,
invoked by `gad-evolution-evolve`) reads this file and decides what the
skill should be. No curator pre-digestion happens — see the 2026-04-13
evolution-loop experiment finding for why
(`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md`).

## How the drafter should enrich this

The drafter should pull additional context from:

- `gad decisions --projectid get-anything-done | grep -i <keyword>` —
  relevant decisions for this phase
- `git log --follow --oneline <file>` — historical context for files this
  phase touched (catches the "three attempts at task X failed" thread that
  lives in commit history)
- `gad --help` and `gad <subcommand> --help` — CLI surface available
  to the skill
- `ls vendor/get-anything-done/skills/` — existing skills to avoid
  duplicating

The drafter does **not** ask a human for anything. Make decisions and
document them in the SKILL.md.

## Output location

The drafter writes to `.planning/proto-skills/phase-22-portfolio-experiment-documentation-hub-p/SKILL.md` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in `skills/` as part of species DNA

The human reviewer runs `gad evolution promote <slug>` or
`gad evolution discard <slug>` after reviewing the proto-skill.
