/**
 * Auto-generated from skills/, agents/, commands/gad/, templates/, and
 * evals/REQUIREMENTS-VERSIONS.md. DO NOT EDIT BY HAND.
 */

export interface CatalogSkill {
  id: string;
  name: string;
  description: string;
  file: string;
}
export interface CatalogAgent {
  id: string;
  name: string;
  description: string;
  tools: string | null;
  color: string | null;
  file: string;
}
export interface CatalogCommand {
  id: string;
  name: string;
  description: string;
  agent: string | null;
  argumentHint: string | null;
  file: string;
}
export interface CatalogTemplate {
  path: string;
  bytes: number;
}
export interface RequirementsVersion {
  version: string;
  date: string;
  rawBody: string;
  sections: Record<string, string>;
}
export interface CurrentRequirementsFile {
  project: string;
  version: string;
  path: string;
  bytes: number;
}

export const SKILLS: CatalogSkill[] = [
  {
    "id": "add-todo",
    "name": "gad:add-todo",
    "description": "Capture an idea, task, or follow-up from the current conversation without losing flow — writes it to .planning/todos/ and updates STATE.md. Use this skill when the user mentions something they want to remember (\"we should also...\", \"don't forget...\", \"add to the list...\"), when execution uncovers work that doesn't belong in the current phase, when a decision surfaces a follow-up task, or when an idea comes up mid-session that shouldn't be forgotten but shouldn't derail the current work. Keeps ideas captured without derailing execution.",
    "file": "vendor/get-anything-done/skills/add-todo/SKILL.md"
  },
  {
    "id": "auto-conventions",
    "name": "gad:auto-conventions",
    "description": "Auto-generate CONVENTIONS.md from codebase patterns after first implementation phase. Use for greenfield projects that have code but no documented conventions.",
    "file": "vendor/get-anything-done/skills/auto-conventions/SKILL.md"
  },
  {
    "id": "check-todos",
    "name": "gad:check-todos",
    "description": "Read current planning state and surface the single best next task or action — the re-entry point for any autonomous loop. Use this skill when the user asks \"what should I work on next?\", \"what's the status?\", \"where are we?\", \"what's next?\", or starts a new session and needs to orient. Also use it to find the next task after completing one, or to decide whether to plan a new phase or execute an existing one. This is the navigation skill — run it between every phase and after any context reset.",
    "file": "vendor/get-anything-done/skills/check-todos/SKILL.md"
  },
  {
    "id": "create-skill",
    "name": "create-skill",
    "description": "Capture a reusable pattern, recipe, or failure-mode fix as a skill document so future agents (including you after a context reset) can apply it without rediscovering it. Use this skill whenever you solve a non-obvious problem, discover a working pattern after two or more failed attempts, hit a bug whose fix isn't self-evident from the code, or finish a piece of work that future runs will likely repeat. Write the skill the moment you learn the lesson — not at the end. In bare/emergent eval conditions this is the primary mechanism for agent-authored methodology: the agent IS the workflow author, and skills are how that authorship persists.",
    "file": "vendor/get-anything-done/skills/create-skill/SKILL.md"
  },
  {
    "id": "debug",
    "name": "gad:debug",
    "description": "Systematic debugging using the scientific method — form hypotheses, test them, eliminate dead ends, and find root causes. Use this skill whenever the user reports a bug, unexpected behavior, test failure, build error, or anything that \"should work but doesn't.\" Also use it when execution hits an unexpected blocker mid-phase, when a verification command produces confusing output, or when multiple debugging attempts have failed and you need a structured approach. Maintains a persistent debug session file so investigation survives context resets.",
    "file": "vendor/get-anything-done/skills/debug/SKILL.md"
  },
  {
    "id": "eval-bootstrap",
    "name": "eval-bootstrap",
    "description": "Bootstrap an eval agent with full GAD context injected into its prompt. Use instead of gad:eval-run when running implementation evals. Generates the bootstrap prompt via `gad eval run --prompt-only` or reads a suite-generated PROMPT.md, then launches an agent with worktree isolation.",
    "file": "vendor/get-anything-done/skills/eval-bootstrap/SKILL.md"
  },
  {
    "id": "eval-report",
    "name": "gad:eval-report",
    "description": "Generate comparison reports across eval runs, within a single project or across all projects",
    "file": "vendor/get-anything-done/skills/eval-report/SKILL.md"
  },
  {
    "id": "eval-run",
    "name": "eval-run",
    "description": "Run a GAD evaluation with full preservation of code, builds, and planning docs",
    "file": "vendor/get-anything-done/skills/eval-run/SKILL.md"
  },
  {
    "id": "eval-suite",
    "name": "gad:eval-suite",
    "description": "Run multiple eval projects in parallel and compare results across all projects",
    "file": "vendor/get-anything-done/skills/eval-suite/SKILL.md"
  },
  {
    "id": "execute-phase",
    "name": "gad:execute-phase",
    "description": "Execute a planned phase by following PLAN.md tasks atomically — commit after each task, update planning docs, and run verify commands at each step. Use this skill when the user wants to execute a phase, start working on planned tasks, run through a phase autonomously, or continue execution of an in-progress phase. This is the autonomous execution skill — if the plan is solid and requirements are clear, Claude should be able to run this to completion without interruption. Requires gad:plan-phase to have been run first to produce a PLAN.md.",
    "file": "vendor/get-anything-done/skills/execute-phase/SKILL.md"
  },
  {
    "id": "find-sprites",
    "name": "find-sprites",
    "description": "Source visual assets (sprites, icons, tilesets, portraits) for a game or UI-heavy build in a way that yields a coherent, intentional look instead of a debug-console aesthetic. Use this skill when you need art for rooms, entities, UI controls, HP bars, spell icons, status effects, or any other visual element; when the build is failing its UI-quality gate because it looks unintentional; or when you're about to fall back to raw ASCII/text UI. The goal is \"looks like someone designed it\" — not photorealism, not 1:1 with AAA games, but internally consistent and readable.",
    "file": "vendor/get-anything-done/skills/find-sprites/SKILL.md"
  },
  {
    "id": "manuscript",
    "name": "gad:manuscript",
    "description": "Fiction and creative writing adaptation of the GAD loop for novels and story outlines",
    "file": "vendor/get-anything-done/skills/manuscript/SKILL.md"
  },
  {
    "id": "map-codebase",
    "name": "gad:map-codebase",
    "description": "Analyze an existing codebase and produce structured documents capturing stack, architecture, conventions, and concerns — used before planning phases in a brownfield project. Use this skill when the user wants to understand an unfamiliar codebase, when starting to plan work in an existing project that has no planning docs, when onboarding to a repo, or when beginning any phase that touches code you haven't read yet. Produces .planning/codebase/ documents that feed directly into gad:new-project and gad:plan-phase. Run once per project or when architecture changes significantly.",
    "file": "vendor/get-anything-done/skills/map-codebase/SKILL.md"
  },
  {
    "id": "milestone",
    "name": "gad:milestone",
    "description": "Manage the full milestone lifecycle — start a new milestone (new version, new cycle), audit a completed one for gaps before archiving, and close it out with git tag and state reset. Use this skill when the user says \"we're starting v2\", \"let's kick off the next release\", \"we finished everything in this milestone, what's next\", \"archive this milestone\", or wants to review whether all planned work is actually done before closing. Also use it when all phases in the roadmap are marked done and you need to decide whether to start fresh planning or close out. Covers gsd:new-milestone + gsd:complete-milestone + gsd:audit-milestone.",
    "file": "vendor/get-anything-done/skills/milestone/SKILL.md"
  },
  {
    "id": "new-project",
    "name": "gad:new-project",
    "description": "Initialize a new project or new section with the GAD planning structure. Use this skill when the user wants to start a new project, set up planning docs for a repo that doesn't have them yet, add a new section to a monorepo, or scaffold requirements/roadmap/state/task-registry. Creates the full .planning/ structure and 5-doc loop, asks the right questions about scope and goals, generates requirements with stable IDs, and produces a phased roadmap. Works for simple repos and monorepos.",
    "file": "vendor/get-anything-done/skills/new-project/SKILL.md"
  },
  {
    "id": "plan-phase",
    "name": "gad:plan-phase",
    "description": "Plan a phase using the GAD methodology — creates a KICKOFF.md with goal/scope/DoD and a PLAN.md with concrete tasks. Use this skill when the user wants to plan the next phase, start planning a feature or milestone, create a task list for a phase, run a kickoff before implementation, or see what tasks are needed to achieve a phase goal. Also use it when a phase exists in the roadmap but has no tasks yet, or when a phase has been idle and assumptions may be stale. Requires repo-planner skill for the full methodology context.",
    "file": "vendor/get-anything-done/skills/plan-phase/SKILL.md"
  },
  {
    "id": "reverse-engineer",
    "name": "gad:reverse-engineer",
    "description": "Analyze any codebase (local path or GitHub URL) and produce GAD planning docs for clean-room reimplementation. Removes dependencies by capturing requirements, not code.",
    "file": "vendor/get-anything-done/skills/reverse-engineer/SKILL.md"
  },
  {
    "id": "session",
    "name": "gad:session",
    "description": "Save and restore full planning context across sessions — creates a handoff file when pausing and restores from it when resuming. Use this skill when the user is about to stop work mid-phase, wants to hand off to a new context window, is starting a new session and needs to orient fully, or when gad:check-todos alone isn't enough because there's in-progress work, unresolved decisions, or active blockers that aren't captured in the living planning docs. Essential for the autonomous execution loop — call it at pause and resume to maintain continuity.",
    "file": "vendor/get-anything-done/skills/session/SKILL.md"
  },
  {
    "id": "snapshot-optimize",
    "name": "gad:snapshot-optimize",
    "description": "Verify and optimize gad snapshot output to fit within the sprint context window. Use after modifying snapshot logic, adding new planning file types, or when snapshot token count exceeds the target budget.",
    "file": "vendor/get-anything-done/skills/snapshot-optimize/SKILL.md"
  },
  {
    "id": "task-checkpoint",
    "name": "gad:task-checkpoint",
    "description": "Verify planning doc updates before proceeding to the next task. Called between tasks during execute-phase to enforce per-task tracking. Checks TASK-REGISTRY.xml and STATE.xml are current.",
    "file": "vendor/get-anything-done/skills/task-checkpoint/SKILL.md"
  },
  {
    "id": "verify-phase",
    "name": "gad:verify-phase",
    "description": "Verify a completed phase achieved its goals. Runs build checks, validates deliverables exist, checks planning doc state, produces VERIFICATION.md. Works automated (eval agents) or interactive (human review). Use after completing a phase, before marking it done in ROADMAP.xml.",
    "file": "vendor/get-anything-done/skills/verify-phase/SKILL.md"
  },
  {
    "id": "write-feature-doc",
    "name": "gad:write-feature-doc",
    "description": "Produce a feature documentation MDX file into the docs sink. Use when a project feature needs clear human-readable documentation that persists across sessions.",
    "file": "vendor/get-anything-done/skills/write-feature-doc/SKILL.md"
  },
  {
    "id": "write-intent",
    "name": "gad:write-intent",
    "description": "Capture user intent for a project into planning docs. Use when starting a new project, clarifying what a project is for, or when requirements are missing or vague.",
    "file": "vendor/get-anything-done/skills/write-intent/SKILL.md"
  },
  {
    "id": "write-tech-doc",
    "name": "gad:write-tech-doc",
    "description": "Produce a technical breakdown doc — architecture, data flow, component design. Use when a system needs to be explained structurally for agent or developer onboarding.",
    "file": "vendor/get-anything-done/skills/write-tech-doc/SKILL.md"
  }
];
export const AGENTS: CatalogAgent[] = [
  {
    "id": "gad-advisor-researcher",
    "name": "gad-advisor-researcher",
    "description": "Researches a single gray area decision and returns a structured comparison table with rationale. Spawned by discuss-phase advisor mode.",
    "tools": "Read, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*",
    "color": "cyan",
    "file": "vendor/get-anything-done/agents/gad-advisor-researcher.md"
  },
  {
    "id": "gad-assumptions-analyzer",
    "name": "gad-assumptions-analyzer",
    "description": "Deeply analyzes codebase for a phase and returns structured assumptions with evidence. Spawned by discuss-phase assumptions mode.",
    "tools": "Read, Bash, Grep, Glob",
    "color": "cyan",
    "file": "vendor/get-anything-done/agents/gad-assumptions-analyzer.md"
  },
  {
    "id": "gad-codebase-mapper",
    "name": "gad-codebase-mapper",
    "description": "Explores codebase and writes structured analysis documents. Spawned by map-codebase with a focus area (tech, arch, quality, concerns). Writes documents directly to reduce orchestrator context load.",
    "tools": "Read, Bash, Grep, Glob, Write",
    "color": "cyan # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-codebase-mapper.md"
  },
  {
    "id": "gad-debugger",
    "name": "gad-debugger",
    "description": "Investigates bugs using scientific method, manages debug sessions, handles checkpoints. Spawned by /gad:debug orchestrator.",
    "tools": "Read, Write, Edit, Bash, Grep, Glob, WebSearch",
    "color": "orange # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-debugger.md"
  },
  {
    "id": "gad-doc-verifier",
    "name": "gad-doc-verifier",
    "description": "Verifies factual claims in generated docs against the live codebase. Returns structured JSON per doc.",
    "tools": "Read, Write, Bash, Grep, Glob",
    "color": "orange # hooks: #   PostToolUse: #     - matcher: \"Write\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-doc-verifier.md"
  },
  {
    "id": "gad-doc-writer",
    "name": "gad-doc-writer",
    "description": "Writes and updates project documentation. Spawned with a doc_assignment block specifying doc type, mode (create/update/supplement), and project context.",
    "tools": "Read, Bash, Grep, Glob, Write",
    "color": "purple # hooks: #   PostToolUse: #     - matcher: \"Write\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-doc-writer.md"
  },
  {
    "id": "gad-executor",
    "name": "gad-executor",
    "description": "Executes GAD plans with atomic commits, deviation handling, checkpoint protocols, and state management. Spawned by execute-phase orchestrator or execute-plan command.",
    "tools": "Read, Write, Edit, Bash, Grep, Glob",
    "color": "yellow # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-executor.md"
  },
  {
    "id": "gad-integration-checker",
    "name": "gad-integration-checker",
    "description": "Verifies cross-phase integration and E2E flows. Checks that phases connect properly and user workflows complete end-to-end.",
    "tools": "Read, Bash, Grep, Glob",
    "color": "blue",
    "file": "vendor/get-anything-done/agents/gad-integration-checker.md"
  },
  {
    "id": "gad-nyquist-auditor",
    "name": "gad-nyquist-auditor",
    "description": "Fills Nyquist validation gaps by generating tests and verifying coverage for phase requirements",
    "tools": "- Read - Write - Edit - Bash - Glob - Grep",
    "color": "\"#8B5CF6\"",
    "file": "vendor/get-anything-done/agents/gad-nyquist-auditor.md"
  },
  {
    "id": "gad-phase-researcher",
    "name": "gad-phase-researcher",
    "description": "Researches how to implement a phase before planning. Produces RESEARCH.md consumed by gad-planner. Spawned by /gad:plan-phase orchestrator.",
    "tools": "Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*",
    "color": "cyan # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-phase-researcher.md"
  },
  {
    "id": "gad-plan-checker",
    "name": "gad-plan-checker",
    "description": "Verifies plans will achieve phase goal before execution. Goal-backward analysis of plan quality. Spawned by /gad:plan-phase orchestrator.",
    "tools": "Read, Bash, Glob, Grep",
    "color": "green",
    "file": "vendor/get-anything-done/agents/gad-plan-checker.md"
  },
  {
    "id": "gad-planner",
    "name": "gad-planner",
    "description": "Creates executable phase plans with task breakdown, dependency analysis, and goal-backward verification. Spawned by /gad:plan-phase orchestrator.",
    "tools": "Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*",
    "color": "green # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-planner.md"
  },
  {
    "id": "gad-project-researcher",
    "name": "gad-project-researcher",
    "description": "Researches domain ecosystem before roadmap creation. Produces files in .planning/research/ consumed during roadmap creation. Spawned by /gad:new-project or /gad:new-milestone orchestrators.",
    "tools": "Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*",
    "color": "cyan # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-project-researcher.md"
  },
  {
    "id": "gad-research-synthesizer",
    "name": "gad-research-synthesizer",
    "description": "Synthesizes research outputs from parallel researcher agents into SUMMARY.md. Spawned by /gad:new-project after 4 researcher agents complete.",
    "tools": "Read, Write, Bash",
    "color": "purple # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-research-synthesizer.md"
  },
  {
    "id": "gad-roadmapper",
    "name": "gad-roadmapper",
    "description": "Creates project roadmaps with phase breakdown, requirement mapping, success criteria derivation, and coverage validation. Spawned by /gad:new-project orchestrator.",
    "tools": "Read, Write, Bash, Glob, Grep",
    "color": "purple # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-roadmapper.md"
  },
  {
    "id": "gad-security-auditor",
    "name": "gad-security-auditor",
    "description": "Verifies threat mitigations from PLAN.md threat model exist in implemented code. Produces SECURITY.md. Spawned by /gad:secure-phase.",
    "tools": "- Read - Write - Edit - Bash - Glob - Grep",
    "color": "\"#EF4444\"",
    "file": "vendor/get-anything-done/agents/gad-security-auditor.md"
  },
  {
    "id": "gad-ui-auditor",
    "name": "gad-ui-auditor",
    "description": "Retroactive 6-pillar visual audit of implemented frontend code. Produces scored UI-REVIEW.md. Spawned by /gad:ui-review orchestrator.",
    "tools": "Read, Write, Bash, Grep, Glob",
    "color": "\"#F472B6\" # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-ui-auditor.md"
  },
  {
    "id": "gad-ui-checker",
    "name": "gad-ui-checker",
    "description": "Validates UI-SPEC.md design contracts against 6 quality dimensions. Produces BLOCK/FLAG/PASS verdicts. Spawned by /gad:ui-phase orchestrator.",
    "tools": "Read, Bash, Glob, Grep",
    "color": "\"#22D3EE\"",
    "file": "vendor/get-anything-done/agents/gad-ui-checker.md"
  },
  {
    "id": "gad-ui-researcher",
    "name": "gad-ui-researcher",
    "description": "Produces UI-SPEC.md design contract for frontend phases. Reads upstream artifacts, detects design system state, asks only unanswered questions. Spawned by /gad:ui-phase orchestrator.",
    "tools": "Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*",
    "color": "\"#E879F9\" # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-ui-researcher.md"
  },
  {
    "id": "gad-user-profiler",
    "name": "gad-user-profiler",
    "description": "Analyzes extracted session messages across 8 behavioral dimensions to produce a scored developer profile with confidence levels and evidence. Spawned by profile orchestration workflows.",
    "tools": "Read",
    "color": "magenta",
    "file": "vendor/get-anything-done/agents/gad-user-profiler.md"
  },
  {
    "id": "gad-verifier",
    "name": "gad-verifier",
    "description": "Verifies phase goal achievement through goal-backward analysis. Checks codebase delivers what phase promised, not just that tasks completed. Creates VERIFICATION.md report.",
    "tools": "Read, Write, Bash, Grep, Glob",
    "color": "green # hooks: #   PostToolUse: #     - matcher: \"Write|Edit\" #       hooks: #         - type: command #           command: \"npx eslint --fix $FILE 2>/dev/null || true\"",
    "file": "vendor/get-anything-done/agents/gad-verifier.md"
  }
];
export const COMMANDS: CatalogCommand[] = [
  {
    "id": "add-backlog",
    "name": "gad:add-backlog",
    "description": "Add an idea to the backlog parking lot (999.x numbering)",
    "agent": null,
    "argumentHint": "<description>",
    "file": "vendor/get-anything-done/commands/gad/add-backlog.md"
  },
  {
    "id": "add-phase",
    "name": "gad:add-phase",
    "description": "Add phase to end of current milestone in roadmap",
    "agent": null,
    "argumentHint": "<description>",
    "file": "vendor/get-anything-done/commands/gad/add-phase.md"
  },
  {
    "id": "add-tests",
    "name": "gad:add-tests",
    "description": "Generate tests for a completed phase based on UAT criteria and implementation",
    "agent": null,
    "argumentHint": "\"<phase> [additional instructions]\"",
    "file": "vendor/get-anything-done/commands/gad/add-tests.md"
  },
  {
    "id": "add-todo",
    "name": "gad:add-todo",
    "description": "Capture idea or task as todo from current conversation context",
    "agent": null,
    "argumentHint": "[optional description]",
    "file": "vendor/get-anything-done/commands/gad/add-todo.md"
  },
  {
    "id": "audit-milestone",
    "name": "gad:audit-milestone",
    "description": "Audit milestone completion against original intent before archiving",
    "agent": null,
    "argumentHint": "\"[version]\"",
    "file": "vendor/get-anything-done/commands/gad/audit-milestone.md"
  },
  {
    "id": "audit-uat",
    "name": "gad:audit-uat",
    "description": "Cross-phase audit of all outstanding UAT and verification items",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/audit-uat.md"
  },
  {
    "id": "auto-conventions",
    "name": "gad:auto-conventions",
    "description": "Auto-scaffold CONVENTIONS.md from codebase patterns after first implementation phase",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/auto-conventions.md"
  },
  {
    "id": "autonomous",
    "name": "gad:autonomous",
    "description": "Run all remaining phases autonomously — discuss→plan→execute per phase",
    "agent": null,
    "argumentHint": "\"[--from N] [--only N] [--interactive]\"",
    "file": "vendor/get-anything-done/commands/gad/autonomous.md"
  },
  {
    "id": "check-todos",
    "name": "gad:check-todos",
    "description": "List pending todos and select one to work on",
    "agent": null,
    "argumentHint": "[area filter]",
    "file": "vendor/get-anything-done/commands/gad/check-todos.md"
  },
  {
    "id": "cleanup",
    "name": "gad:cleanup",
    "description": "Archive accumulated phase directories from completed milestones",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/cleanup.md"
  },
  {
    "id": "complete-milestone",
    "name": "gad:complete-milestone",
    "description": "Archive completed milestone and prepare for next version",
    "agent": null,
    "argumentHint": "<version>",
    "file": "vendor/get-anything-done/commands/gad/complete-milestone.md"
  },
  {
    "id": "debug",
    "name": "gad:debug",
    "description": "Systematic debugging with persistent state across context resets",
    "agent": null,
    "argumentHint": "[--diagnose] [issue description]",
    "file": "vendor/get-anything-done/commands/gad/debug.md"
  },
  {
    "id": "discuss-phase",
    "name": "gad:discuss-phase",
    "description": "Gather phase context through adaptive questioning before planning. Use --auto to skip interactive questions (Claude picks recommended defaults). Use --chain for interactive discuss followed by automatic plan+execute.",
    "agent": null,
    "argumentHint": "\"<phase> [--auto] [--chain] [--batch] [--analyze] [--text]\"",
    "file": "vendor/get-anything-done/commands/gad/discuss-phase.md"
  },
  {
    "id": "do",
    "name": "gad:do",
    "description": "Route freeform text to the right GAD command automatically",
    "agent": null,
    "argumentHint": "\"<description of what you want to do>\"",
    "file": "vendor/get-anything-done/commands/gad/do.md"
  },
  {
    "id": "docs-compile",
    "name": "gad:docs-compile",
    "description": "Compile planning docs from all roots into docs_sink as MDX files",
    "agent": null,
    "argumentHint": "[--sink <path>]",
    "file": "vendor/get-anything-done/commands/gad/docs-compile.md"
  },
  {
    "id": "docs-update",
    "name": "gad:docs-update",
    "description": "Generate or update project documentation verified against the codebase",
    "agent": null,
    "argumentHint": "\"[--force] [--verify-only]\"",
    "file": "vendor/get-anything-done/commands/gad/docs-update.md"
  },
  {
    "id": "eval-bootstrap",
    "name": "gad:eval-bootstrap",
    "description": "Bootstrap an eval agent with full GAD context injected into its prompt",
    "agent": null,
    "argumentHint": "--project <name>",
    "file": "vendor/get-anything-done/commands/gad/eval-bootstrap.md"
  },
  {
    "id": "eval-list",
    "name": "gad:eval-list",
    "description": "List available eval projects and their run history",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/eval-list.md"
  },
  {
    "id": "eval-report",
    "name": "gad:eval-report",
    "description": "Show cross-project eval comparison and findings",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/eval-report.md"
  },
  {
    "id": "eval-run",
    "name": "gad:eval-run",
    "description": "Run an eval project in an isolated git worktree",
    "agent": null,
    "argumentHint": "--project <name> [--baseline <sha>] [--agent <model>]",
    "file": "vendor/get-anything-done/commands/gad/eval-run.md"
  },
  {
    "id": "eval-suite",
    "name": "gad:eval-suite",
    "description": "Run all eval projects in parallel with bootstrap prompts",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/eval-suite.md"
  },
  {
    "id": "execute-phase",
    "name": "gad:execute-phase",
    "description": "Execute all plans in a phase with wave-based parallelization",
    "agent": null,
    "argumentHint": "\"<phase-number> [--wave N] [--gaps-only] [--interactive]\"",
    "file": "vendor/get-anything-done/commands/gad/execute-phase.md"
  },
  {
    "id": "forensics",
    "name": "gad:forensics",
    "description": "Post-mortem investigation for failed GAD workflows — analyzes git history, artifacts, and state to diagnose what went wrong",
    "agent": null,
    "argumentHint": "\"[problem description]\"",
    "file": "vendor/get-anything-done/commands/gad/forensics.md"
  },
  {
    "id": "health",
    "name": "gad:health",
    "description": "Diagnose planning directory health and optionally repair issues",
    "agent": null,
    "argumentHint": "[--repair]",
    "file": "vendor/get-anything-done/commands/gad/health.md"
  },
  {
    "id": "help",
    "name": "gad:help",
    "description": "Show available GAD commands and usage guide",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/help.md"
  },
  {
    "id": "insert-phase",
    "name": "gad:insert-phase",
    "description": "Insert urgent work as decimal phase (e.g., 72.1) between existing phases",
    "agent": null,
    "argumentHint": "<after> <description>",
    "file": "vendor/get-anything-done/commands/gad/insert-phase.md"
  },
  {
    "id": "join-discord",
    "name": "gad:join-discord",
    "description": "Join the GAD Discord community",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/join-discord.md"
  },
  {
    "id": "list-phase-assumptions",
    "name": "gad:list-phase-assumptions",
    "description": "Surface Claude's assumptions about a phase approach before planning",
    "agent": null,
    "argumentHint": "\"[phase]\"",
    "file": "vendor/get-anything-done/commands/gad/list-phase-assumptions.md"
  },
  {
    "id": "manager",
    "name": "gad:manager",
    "description": "Interactive command center for managing multiple phases from one terminal",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/manager.md"
  },
  {
    "id": "manuscript",
    "name": "gad:manuscript",
    "description": "Fiction writing adaptation of the GAD loop for novels and story outlines",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/manuscript.md"
  },
  {
    "id": "map-codebase",
    "name": "gad:map-codebase",
    "description": "Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents",
    "agent": null,
    "argumentHint": "\"[optional: specific area to map, e.g., 'api' or 'auth']\"",
    "file": "vendor/get-anything-done/commands/gad/map-codebase.md"
  },
  {
    "id": "migrate-schema",
    "name": "gad:migrate-schema",
    "description": "Convert RP XML planning files (STATE.xml, ROADMAP.xml) to GAD Markdown format",
    "agent": null,
    "argumentHint": "[--path <planning-dir>]",
    "file": "vendor/get-anything-done/commands/gad/migrate-schema.md"
  },
  {
    "id": "milestone-summary",
    "name": "gad:milestone-summary",
    "description": "Generate a comprehensive project summary from milestone artifacts for team onboarding and review",
    "agent": null,
    "argumentHint": "\"[version]\"",
    "file": "vendor/get-anything-done/commands/gad/milestone-summary.md"
  },
  {
    "id": "new-milestone",
    "name": "gad:new-milestone",
    "description": "Start a new milestone cycle — update PROJECT.md and route to requirements",
    "agent": null,
    "argumentHint": "\"[milestone name, e.g., 'v1.1 Notifications']\"",
    "file": "vendor/get-anything-done/commands/gad/new-milestone.md"
  },
  {
    "id": "new-project",
    "name": "gad:new-project",
    "description": "Initialize a new project with deep context gathering and PROJECT.md",
    "agent": null,
    "argumentHint": "\"[--auto]\"",
    "file": "vendor/get-anything-done/commands/gad/new-project.md"
  },
  {
    "id": "next",
    "name": "gad:next",
    "description": "Automatically advance to the next logical step in the GAD workflow",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/next.md"
  },
  {
    "id": "note",
    "name": "gad:note",
    "description": "Zero-friction idea capture. Append, list, or promote notes to todos.",
    "agent": null,
    "argumentHint": "\"<text> | list | promote <N> [--global]\"",
    "file": "vendor/get-anything-done/commands/gad/note.md"
  },
  {
    "id": "pause-work",
    "name": "gad:pause-work",
    "description": "Create context handoff when pausing work mid-phase",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/pause-work.md"
  },
  {
    "id": "plan-milestone-gaps",
    "name": "gad:plan-milestone-gaps",
    "description": "Create phases to close all gaps identified by milestone audit",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/plan-milestone-gaps.md"
  },
  {
    "id": "plan-phase",
    "name": "gad:plan-phase",
    "description": "Create detailed phase plan (PLAN.md) with verification loop",
    "agent": "gad-planner",
    "argumentHint": "\"[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text]\"",
    "file": "vendor/get-anything-done/commands/gad/plan-phase.md"
  },
  {
    "id": "plant-seed",
    "name": "gad:plant-seed",
    "description": "Capture a forward-looking idea with trigger conditions — surfaces automatically at the right milestone",
    "agent": null,
    "argumentHint": "\"[idea summary]\"",
    "file": "vendor/get-anything-done/commands/gad/plant-seed.md"
  },
  {
    "id": "progress",
    "name": "gad:progress",
    "description": "Check project progress, show context, and route to next action (execute or plan)",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/progress.md"
  },
  {
    "id": "reapply-patches",
    "name": "gad:reapply-patches",
    "description": "Reapply local modifications after a GAD update",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/reapply-patches.md"
  },
  {
    "id": "remove-phase",
    "name": "gad:remove-phase",
    "description": "Remove a future phase from roadmap and renumber subsequent phases",
    "agent": null,
    "argumentHint": "<phase-number>",
    "file": "vendor/get-anything-done/commands/gad/remove-phase.md"
  },
  {
    "id": "research-phase",
    "name": "gad:research-phase",
    "description": "Research how to implement a phase (standalone - usually use /gad:plan-phase instead)",
    "agent": null,
    "argumentHint": "\"[phase]\"",
    "file": "vendor/get-anything-done/commands/gad/research-phase.md"
  },
  {
    "id": "resume-work",
    "name": "gad:resume-work",
    "description": "Resume work from previous session with full context restoration",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/resume-work.md"
  },
  {
    "id": "reverse-engineer",
    "name": "gad:reverse-engineer",
    "description": "Analyze any codebase (local or GitHub URL) and produce requirements for clean-room reimplementation",
    "agent": null,
    "argumentHint": "--path <local-path> | --repo <github-url> [--branch <branch>]",
    "file": "vendor/get-anything-done/commands/gad/reverse-engineer.md"
  },
  {
    "id": "review-backlog",
    "name": "gad:review-backlog",
    "description": "Review and promote backlog items to active milestone",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/review-backlog.md"
  },
  {
    "id": "review",
    "name": "gad:review",
    "description": "Request cross-AI peer review of phase plans from external AI CLIs",
    "agent": null,
    "argumentHint": "\"--phase N [--gemini] [--claude] [--codex] [--opencode] [--all]\"",
    "file": "vendor/get-anything-done/commands/gad/review.md"
  },
  {
    "id": "session-report",
    "name": "gad:session-report",
    "description": "Generate a session report with token usage estimates, work summary, and outcomes",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/session-report.md"
  },
  {
    "id": "set-profile",
    "name": "gad:set-profile",
    "description": "Switch model profile for GAD agents (quality/balanced/budget/inherit)",
    "agent": null,
    "argumentHint": "<profile (quality|balanced|budget|inherit)>",
    "file": "vendor/get-anything-done/commands/gad/set-profile.md"
  },
  {
    "id": "settings",
    "name": "gad:settings",
    "description": "Configure GAD workflow toggles and model profile",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/settings.md"
  },
  {
    "id": "stats",
    "name": "gad:stats",
    "description": "Display project statistics — phases, plans, requirements, git metrics, and timeline",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/stats.md"
  },
  {
    "id": "thread",
    "name": "gad:thread",
    "description": "Manage persistent context threads for cross-session work",
    "agent": null,
    "argumentHint": "[name | description]",
    "file": "vendor/get-anything-done/commands/gad/thread.md"
  },
  {
    "id": "update",
    "name": "gad:update",
    "description": "Update GAD to latest version with changelog display",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/update.md"
  },
  {
    "id": "validate-phase",
    "name": "gad:validate-phase",
    "description": "Retroactively audit and fill Nyquist validation gaps for a completed phase",
    "agent": null,
    "argumentHint": "\"[phase number]\"",
    "file": "vendor/get-anything-done/commands/gad/validate-phase.md"
  },
  {
    "id": "verify-work",
    "name": "gad:verify-work",
    "description": "Validate built features through conversational UAT",
    "agent": null,
    "argumentHint": "\"[phase number, e.g., '4']\"",
    "file": "vendor/get-anything-done/commands/gad/verify-work.md"
  },
  {
    "id": "workspace-add",
    "name": "gad:workspace-add",
    "description": "Add a path as a planning root in planning-config.toml",
    "agent": null,
    "argumentHint": "<path> [--id <id>]",
    "file": "vendor/get-anything-done/commands/gad/workspace-add.md"
  },
  {
    "id": "workspace-show",
    "name": "gad:workspace-show",
    "description": "Show all registered planning roots and their current status",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/workspace-show.md"
  },
  {
    "id": "workspace-sync",
    "name": "gad:workspace-sync",
    "description": "Crawl monorepo for .planning/ directories and sync planning-config.toml roots",
    "agent": null,
    "argumentHint": null,
    "file": "vendor/get-anything-done/commands/gad/workspace-sync.md"
  }
];
export const TEMPLATES: CatalogTemplate[] = [
  {
    "path": "claude-md.md",
    "bytes": 4433
  },
  {
    "path": "codebase/architecture.md",
    "bytes": 7523
  },
  {
    "path": "codebase/concerns.md",
    "bytes": 11579
  },
  {
    "path": "codebase/conventions.md",
    "bytes": 9139
  },
  {
    "path": "codebase/integrations.md",
    "bytes": 8944
  },
  {
    "path": "codebase/stack.md",
    "bytes": 4652
  },
  {
    "path": "codebase/structure.md",
    "bytes": 8409
  },
  {
    "path": "codebase/testing.md",
    "bytes": 11473
  },
  {
    "path": "config.json",
    "bytes": 1157
  },
  {
    "path": "context.md",
    "bytes": 9832
  },
  {
    "path": "continue-here.md",
    "bytes": 1821
  },
  {
    "path": "copilot-instructions.md",
    "bytes": 648
  },
  {
    "path": "debug-subagent-prompt.md",
    "bytes": 1802
  },
  {
    "path": "DEBUG.md",
    "bytes": 4588
  },
  {
    "path": "dev-preferences.md",
    "bytes": 543
  },
  {
    "path": "discovery.md",
    "bytes": 4077
  },
  {
    "path": "discussion-log.md",
    "bytes": 1818
  },
  {
    "path": "milestone-archive.md",
    "bytes": 2803
  },
  {
    "path": "milestone.md",
    "bytes": 3057
  },
  {
    "path": "phase-prompt.md",
    "bytes": 18427
  },
  {
    "path": "planner-subagent-prompt.md",
    "bytes": 2682
  },
  {
    "path": "planning-config.toml",
    "bytes": 1960
  },
  {
    "path": "project.md",
    "bytes": 5104
  },
  {
    "path": "requirements.md",
    "bytes": 6071
  },
  {
    "path": "research-project/ARCHITECTURE.md",
    "bytes": 7135
  },
  {
    "path": "research-project/FEATURES.md",
    "bytes": 4467
  },
  {
    "path": "research-project/PITFALLS.md",
    "bytes": 5711
  },
  {
    "path": "research-project/STACK.md",
    "bytes": 3212
  },
  {
    "path": "research-project/SUMMARY.md",
    "bytes": 4572
  },
  {
    "path": "research.md",
    "bytes": 16340
  },
  {
    "path": "retrospective.md",
    "bytes": 1255
  },
  {
    "path": "roadmap.md",
    "bytes": 5666
  },
  {
    "path": "SECURITY.md",
    "bytes": 1488
  },
  {
    "path": "state.md",
    "bytes": 4548
  },
  {
    "path": "summary-complex.md",
    "bytes": 1308
  },
  {
    "path": "summary-minimal.md",
    "bytes": 861
  },
  {
    "path": "summary-standard.md",
    "bytes": 1054
  },
  {
    "path": "summary.md",
    "bytes": 7826
  },
  {
    "path": "UAT.md",
    "bytes": 6860
  },
  {
    "path": "UI-SPEC.md",
    "bytes": 2296
  },
  {
    "path": "user-profile.md",
    "bytes": 3054
  },
  {
    "path": "user-setup.md",
    "bytes": 9047
  },
  {
    "path": "VALIDATION.md",
    "bytes": 2176
  },
  {
    "path": "verification-report.md",
    "bytes": 9641
  }
];
export const REQUIREMENTS_HISTORY: RequirementsVersion[] = [
  {
    "version": "v1",
    "date": "2026-04-06",
    "rawBody": "**Scope:** Systems-focused. 12 success criteria describing what the agent should build.\r\nNo gates. No UI quality mandate. No priority on vertical slice.\r\n\r\n**Problems that emerged:**\r\n- Agents built invisible backend systems with no UI\r\n- requirement_coverage scored 1.0 while the game showed a blank screen\r\n- No way to distinguish \"code exists\" from \"game works\"\r\n\r\n---",
    "sections": {
      "scope": "Systems-focused. 12 success criteria describing what the agent should build.\r\nNo gates. No UI quality mandate. No priority on vertical slice.",
      "problems_that_emerged": "- Agents built invisible backend systems with no UI\r\n- requirement_coverage scored 1.0 while the game showed a blank screen\r\n- No way to distinguish \"code exists\" from \"game works\"\r\n\r\n---"
    }
  },
  {
    "version": "v2",
    "date": "2026-04-08",
    "rawBody": "**Changes from v1:**\r\n- Added 2 gate criteria (production build renders, playable vertical slice)\r\n- Added `<vertical-slice>` section describing the UI-first build order\r\n- Marked gates with `gate=\"true\"` attribute\r\n- Trimmed source gameplay design doc from 640 → 127 lines\r\n\r\n**Scoring impact:**\r\n- Gate criteria override: if any `gate=\"true\"` fails, requirement_coverage = 0\r\n\r\n**Problems that emerged:**\r\n- Gates helped but bare and GAD still produced broken game loops\r\n- UI quality gate was vague — agents produced \"raw ASCII\" output and claimed it passed\r\n- Rune forge (spell crafting) was listed as a criterion but always skipped\r\n\r\n---",
    "sections": {
      "changes_from_v1": "- Added 2 gate criteria (production build renders, playable vertical slice)\r\n- Added `<vertical-slice>` section describing the UI-first build order\r\n- Marked gates with `gate=\"true\"` attribute\r\n- Trimmed source gameplay design doc from 640 → 127 lines",
      "scoring_impact": "- Gate criteria override: if any `gate=\"true\"` fails, requirement_coverage = 0",
      "problems_that_emerged": "- Gates helped but bare and GAD still produced broken game loops\r\n- UI quality gate was vague — agents produced \"raw ASCII\" output and claimed it passed\r\n- Rune forge (spell crafting) was listed as a criterion but always skipped\r\n\r\n---"
    }
  },
  {
    "version": "v3",
    "date": "2026-04-08",
    "rawBody": "**Changes from v2:**\r\n- Restructured into explicit `<gate-criteria>` section with 3 numbered gates\r\n- **G1 Game loop**: complete cycle title → new game → room → navigate → combat → return → continue\r\n- **G2 Spell crafting**: rune forge with combine → create → use. Loot doesn't count.\r\n- **G3 UI quality**: icons, styled buttons, HP bars, room-type differentiation, entity sprites/portraits\r\n- Added asset sourcing guidance (npm packages > web search > generated > geometric fallback)\r\n- Added `<vertical-slice>` build order (UI first, systems after)\r\n- Explicit \"don't get stuck gold-plating\" guardrail for assets\r\n\r\n**Scoring impact:**\r\n- Composite formula v3: weights (0.15, 0.15, 0.15, 0.10, 0.05, 0.30)\r\n- human_review weight 0.30 (up from 0.15)\r\n- Low-score caps: < 0.20 → 0.40, < 0.10 → 0.25\r\n\r\n**Problems that emerged:**\r\n- Rune forge was built but not integrated with progression (no affinity, no evolution, no training)\r\n- No floor progression — players stuck on first floor forever\r\n- No grinding / respawning encounters\r\n- Skills (physical actions) vs spells (mana) not differentiated\r\n- Narrative stats shown as labels that confused players — needed to be called \"Traits\"\r\n- Agents ignored asset sourcing and used raw text-only UI\r\n\r\n---",
    "sections": {
      "changes_from_v2": "- Restructured into explicit `<gate-criteria>` section with 3 numbered gates\r\n- **G1 Game loop**: complete cycle title → new game → room → navigate → combat → return → continue\r\n- **G2 Spell crafting**: rune forge with combine → create → use. Loot doesn't count.\r\n- **G3 UI quality**: icons, styled buttons, HP bars, room-type differentiation, entity sprites/portraits\r\n- Added asset sourcing guidance (npm packages > web search > generated > geometric fallback)\r\n- Added `<vertical-slice>` build order (UI first, systems after)\r\n- Explicit \"don't get stuck gold-plating\" guardrail for assets",
      "scoring_impact": "- Composite formula v3: weights (0.15, 0.15, 0.15, 0.10, 0.05, 0.30)\r\n- human_review weight 0.30 (up from 0.15)\r\n- Low-score caps: < 0.20 → 0.40, < 0.10 → 0.25",
      "problems_that_emerged": "- Rune forge was built but not integrated with progression (no affinity, no evolution, no training)\r\n- No floor progression — players stuck on first floor forever\r\n- No grinding / respawning encounters\r\n- Skills (physical actions) vs spells (mana) not differentiated\r\n- Narrative stats shown as labels that confused players — needed to be called \"Traits\"\r\n- Agents ignored asset sourcing and used raw text-only UI\r\n\r\n---"
    }
  },
  {
    "version": "v4",
    "date": "2026-04-08",
    "rawBody": "**Core shift from v3:** Pressure-oriented design. Previous versions were feature\r\nchecklists. v4 reframes around \"every system must create friction that rewards\r\ncreative player choice.\" Central principle: **baseline starter abilities must NOT\r\nbe sufficient to comfortably complete a full floor**.\r\n\r\n**Changes from v3:**\r\n- Authored-only (explicitly no procedural generation)\r\n- Floors → Rooms → Boss gate hierarchy; 5-8 rooms per floor\r\n- Room types: Combat, Elite, Forge, Rest, Event (mechanically distinct)\r\n- Each floor must introduce a mechanical constraint that can't be brute-forced with default spells\r\n- Respawning encounters on cleared floors allowed (grinding)\r\n- G2 forge gate expanded: not just \"crafting exists\" but **at least one encounter per floor must significantly favor crafted/adapted spells**\r\n- G4 pressure mechanics gate added: must include at least 2 of (resource pressure, enemy counterplay, encounter design pressure, build pressure)\r\n- New ingenuity_score dimension measures whether player had to adapt\r\n- Skills system: scored (not gate) — combat must support at least one non-spell action category but full skill system is bonus\r\n- Asset sourcing: attempt-first workflow (find-sprites skill), coherent fallback allowed only when sourcing genuinely fails\r\n- Terminology split: UI shows \"Traits\", code uses `narrativeStats`\r\n\r\n**Deferred to v5:**\r\n- Rune affinity decay when unused\r\n- Deep evolution trees (multi-stage mutations)\r\n- Full authored spell customization (naming still allowed in v4)\r\n\r\n**Scoring impact:**\r\n- Gates: game-loop, forge-with-ingenuity-payoff, ui-quality, pressure-mechanics (4 gates now)\r\n- Composite weights unchanged from v3 (human_review 0.30, low-score caps)\r\n- New ingenuity_score as a scored dimension (not yet in composite — evaluated in round 4 results)\r\n\r\n**Brownfield vs greenfield:**\r\n- Greenfield v4 applies to escape-the-dungeon, escape-the-dungeon-bare, escape-the-dungeon-emergent\r\n- Brownfield v4 extensions live in `_brownfield-extensions-v4.md` (similar direction, applied to bare v3 baseline)\r\n\r\n**Decision references:** gad-41 (pressure reframe), gad-42 (skills scored), gad-43 (sprite sourcing), gad-44 (Traits terminology), gad-48 (GAD diagnosis deferred)",
    "sections": {
      "core_shift_from_v3": "Pressure-oriented design. Previous versions were feature\r\nchecklists. v4 reframes around \"every system must create friction that rewards\r\ncreative player choice.\" Central principle: **baseline starter abilities must NOT\r\nbe sufficient to comfortably complete a full floor**.",
      "changes_from_v3": "- Authored-only (explicitly no procedural generation)\r\n- Floors → Rooms → Boss gate hierarchy; 5-8 rooms per floor\r\n- Room types: Combat, Elite, Forge, Rest, Event (mechanically distinct)\r\n- Each floor must introduce a mechanical constraint that can't be brute-forced with default spells\r\n- Respawning encounters on cleared floors allowed (grinding)\r\n- G2 forge gate expanded: not just \"crafting exists\" but **at least one encounter per floor must significantly favor crafted/adapted spells**\r\n- G4 pressure mechanics gate added: must include at least 2 of (resource pressure, enemy counterplay, encounter design pressure, build pressure)\r\n- New ingenuity_score dimension measures whether player had to adapt\r\n- Skills system: scored (not gate) — combat must support at least one non-spell action category but full skill system is bonus\r\n- Asset sourcing: attempt-first workflow (find-sprites skill), coherent fallback allowed only when sourcing genuinely fails\r\n- Terminology split: UI shows \"Traits\", code uses `narrativeStats`",
      "deferred_to_v5": "- Rune affinity decay when unused\r\n- Deep evolution trees (multi-stage mutations)\r\n- Full authored spell customization (naming still allowed in v4)",
      "scoring_impact": "- Gates: game-loop, forge-with-ingenuity-payoff, ui-quality, pressure-mechanics (4 gates now)\r\n- Composite weights unchanged from v3 (human_review 0.30, low-score caps)\r\n- New ingenuity_score as a scored dimension (not yet in composite — evaluated in round 4 results)",
      "brownfield_vs_greenfield": "- Greenfield v4 applies to escape-the-dungeon, escape-the-dungeon-bare, escape-the-dungeon-emergent\r\n- Brownfield v4 extensions live in `_brownfield-extensions-v4.md` (similar direction, applied to bare v3 baseline)",
      "decision_references": "gad-41 (pressure reframe), gad-42 (skills scored), gad-43 (sprite sourcing), gad-44 (Traits terminology), gad-48 (GAD diagnosis deferred)"
    }
  }
];
export const CURRENT_REQUIREMENTS: CurrentRequirementsFile[] = [
  {
    "project": "escape-the-dungeon",
    "version": "v4",
    "path": "/downloads/requirements/escape-the-dungeon-REQUIREMENTS-v4.xml",
    "bytes": 15281
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v4",
    "path": "/downloads/requirements/escape-the-dungeon-bare-REQUIREMENTS-v4.xml",
    "bytes": 15281
  },
  {
    "project": "escape-the-dungeon-emergent",
    "version": "v4",
    "path": "/downloads/requirements/escape-the-dungeon-emergent-REQUIREMENTS-v4.xml",
    "bytes": 15281
  }
];

export const GITHUB_REPO = "https://github.com/MagicbornStudios/get-anything-done";
