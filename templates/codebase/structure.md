# Structure Template

Template for `.planning/codebase/STRUCTURE.md`.

**Purpose:** document where things physically live in the codebase and answer "where do I put X?"

---

## File Template

```markdown
# Codebase Structure

**Analysis Date:** [YYYY-MM-DD]

## Directory Layout

[ASCII tree of top-level directories with purpose comments]

```
[project-root]/
├── [dir]/          # [Purpose]
├── [dir]/          # [Purpose]
├── [dir]/          # [Purpose]
└── [file]          # [Purpose]
```

## Directory Purposes

**[Directory Name]:**
- Purpose: [What lives here]
- Contains: [Types of files]
- Key files: [Important files]
- Subdirectories: [If nested, describe structure]

## Key File Locations

**Entry Points:**
- [Path]: [CLI or app entry point]

**Configuration:**
- [Path]: [TypeScript, build, env, or runtime config]

**Core Logic:**
- [Path]: [Business logic / runtime logic]

**Testing:**
- [Path]: [Unit, integration, or fixtures]

**Documentation:**
- [Path]: [User-facing or developer-facing docs]

## Naming Conventions

**Files:**
- [Pattern]: [Example]

**Directories:**
- [Pattern]: [Example]

**Special Patterns:**
- [Pattern]: [Example]

## Where to Add New Code

**New Feature:**
- Primary code: [Directory path]
- Tests: [Directory path]
- Config if needed: [Directory path]

**New Component/Module:**
- Implementation: [Directory path]
- Types: [Directory path]
- Tests: [Directory path]

**New Route / Skill / Command Wrapper:**
- Canonical source: [Directory path]
- Generated compatibility output: [Directory path, if applicable]
- Tests: [Directory path]

**Utilities:**
- Shared helpers: [Directory path]
- Type definitions: [Directory path]

## Special Directories

**[Directory]:**
- Purpose: [Generated code, build output, cache, docs sink, etc.]
- Source: [What produces it]
- Committed: [Yes/No]
```

<good_examples>
```markdown
# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
get-anything-done/
├── bin/                # CLI entry points
├── sdk/                # Canonical runtime-consumer assets
│   ├── skills/         # Installable public skills
│   ├── workflows/      # Reusable workflow documents
│   ├── templates/      # Prompt and planning templates
│   ├── references/     # Supporting reference docs
│   ├── hooks/          # Runtime hook sources
│   └── agents/         # Named agent prompt files
├── skills/             # Repo-local/internal skills
├── site/               # Public framework site
├── tests/              # Test suites
├── package.json        # Project manifest
└── README.md           # User documentation
```

## Directory Purposes

**bin/**
- Purpose: CLI entry points and installers
- Contains: `gad.cjs`, `install.js`, runtime helpers

**skills/**
- Purpose: Canonical public skill source
- Contains: one directory per installable skill with `SKILL.md`

**workflows/**
- Purpose: Long-form execution specs used by skills and prompts
- Contains: `plan-phase.md`, `execute-phase.md`, `verify-phase.md`, etc.

**templates/**
- Purpose: Reusable planning and prompt templates
- Contains: `project.md`, `roadmap.md`, `summary.md`, `verification-report.md`, `codebase/*`

**references/**
- Purpose: Supporting reference documents used by workflows and skills

**hooks/**
- Purpose: Runtime hook source files packaged for supported runtimes

## Where to Add New Code

**New Skill:**
- Canonical source: `skills/{skill-name}/SKILL.md`
- Generated compatibility output: runtime-specific command wrappers at install/build time

**New Workflow:**
- Canonical source: `workflows/{name}.md`
- Usage: reference from skills or templates with `@workflows/{name}.md`

**New Template:**
- Canonical source: `templates/{name}.md`

**New Reference Document:**
- Canonical source: `references/{name}.md`

## Special Directories

**sdk/**
- Purpose: canonical framework assets for consumers and runtime installs
- Source: authored in-repo and copied/transpiled by install/build scripts
- Committed: Yes

**Generated runtime command wrappers**
- Purpose: compatibility output for runtimes that require command files
- Source: generated from canonical sdk assets
- Committed: No
```
</good_examples>

<guidelines>
**What belongs in STRUCTURE.md:**
- Directory layout
- Purpose of each directory
- Key file locations
- Naming conventions
- Where new code should go
- Which directories are generated versus canonical

**What does NOT belong here:**
- Conceptual architecture
- Technology stack rationale
- Low-level implementation details

**When filling this template:**
- Use `tree` or `rg --files` to inspect structure
- Keep the tree concise
- Prefer canonical source locations over generated outputs
</guidelines>

