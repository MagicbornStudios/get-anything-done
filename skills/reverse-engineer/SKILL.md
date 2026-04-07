---
name: gad:reverse-engineer
description: Point at a repo or codebase and produce GAD requirements, decisions, and a planning scaffold from what exists. License-safe — captures requirements and architecture, not code. Inspired by RepoMirror's analysis-first approach.
---

# gad:reverse-engineer

Analyzes an existing codebase and produces structured GAD planning docs (REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml) that capture what was built, why, and how. The output is a complete GAD project scaffold ready for an eval agent to re-implement from scratch.

## When to use

- Reverse-engineering an existing project to create eval requirements
- Onboarding to an unfamiliar codebase — produce requirements + architecture docs
- Creating a license-safe specification from a reference implementation
- Setting up a GAD eval project from an existing repo

## What it produces

1. **REQUIREMENTS.xml** — structured requirements derived from the codebase
2. **DECISIONS.xml** — architectural decisions inferred from code patterns
3. **CONVENTIONS.md** — coding conventions observed in the codebase
4. **ROADMAP.xml** — suggested phase breakdown for re-implementation
5. **CONTEXT.md** — key context about the project's purpose, stack, and design

## What it does NOT produce

- No copied source code (license-safe)
- No line-for-line implementation details
- No proprietary algorithms or business logic specifics
- Only captures WHAT was built and WHY, not HOW at the code level

## Step 1 — Identify the target

```sh
# Point at a local repo
gad reverse-engineer --path vendor/repub-builder

# Or a specific subdirectory
gad reverse-engineer --path vendor/repub-builder/src/reader

# Or a remote repo (clones to temp)
gad reverse-engineer --repo https://github.com/org/project
```

## Step 2 — Explore the codebase (read-only)

Use read-only tools to understand the project. Do NOT modify any files in the target.

### 2a. Structure scan
```sh
# File tree
find <path> -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" | head -50

# Package.json for stack
cat <path>/package.json

# README for purpose
cat <path>/README.md
```

### 2b. Architecture analysis
- Entry points (main files, CLI commands, exports)
- Component/module boundaries
- Data flow (what talks to what)
- External dependencies (APIs, databases, services)
- State management patterns
- UI component hierarchy (if frontend)

### 2c. Pattern extraction
- File naming conventions
- Import patterns
- Type system usage
- Error handling approach
- Test patterns
- Content/data model

## Step 3 — Produce requirements

Write REQUIREMENTS.xml structured as:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<requirements>
  <goal>One-sentence project purpose derived from README/code</goal>
  <audience>Who uses this and how</audience>

  <success-criteria>
    <criterion>User-facing capability 1</criterion>
    <criterion>User-facing capability 2</criterion>
    <!-- One criterion per observable feature -->
  </success-criteria>

  <non-goals>
    <item>What this project explicitly doesn't do</item>
  </non-goals>

  <core-systems>
    <system id="system-name">What this system does, its inputs/outputs, key interfaces</system>
    <!-- One system per major module/component boundary -->
  </core-systems>

  <stack>
    <item>Framework/library and why it's used</item>
  </stack>
</requirements>
```

### Requirements quality rules
- Each criterion must be **testable** — an agent can verify it
- Each system must describe **what**, not **how** — no implementation details
- Stack items include the **why** — "React for component UI" not just "React"
- Capture **every user-facing feature** you observe, not just the obvious ones

## Step 4 — Infer decisions

Write DECISIONS.xml with architectural choices observed:

```xml
<decision id="re-01">
  <title>Choice observed in codebase</title>
  <summary>What was chosen and evidence of why</summary>
  <impact>How this constrains re-implementation</impact>
</decision>
```

Common decisions to look for:
- Framework/library choices and their tradeoffs
- State management approach
- Data model design
- UI architecture (component hierarchy, routing)
- Build tooling choices
- Testing strategy

## Step 5 — Extract conventions

Write CONVENTIONS.md documenting:
- File structure and organization
- Naming conventions (files, exports, types, components)
- Import patterns
- Code style patterns
- Content/data format conventions

## Step 6 — Suggest implementation roadmap

Write ROADMAP.xml with a phased re-implementation plan:

```xml
<phase id="01">
  <title>Foundation</title>
  <goal>Project scaffold, core types, build tooling</goal>
  <status>planned</status>
</phase>
```

Phase ordering should follow dependency order — what needs to exist before what.

## Step 7 — Create eval project (optional)

If creating an eval project from the reverse-engineered requirements:

```sh
gad eval setup --project <name>
```

Then copy the produced REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, and ROADMAP.xml into the eval template.

## RepoMirror inspiration

This skill takes RepoMirror's approach of analysis-first, transformation-second:
- **RepoMirror:** analyze source → generate transformation prompt → port code
- **GAD reverse-engineer:** analyze source → generate requirements → eval agent implements from requirements

Both are license-safe because the output is a specification, not copied code. The eval agent implements from the spec without seeing the original source.

## Definition of done

1. REQUIREMENTS.xml covers every observable feature
2. DECISIONS.xml captures 5+ architectural choices
3. CONVENTIONS.md documents patterns the re-implementation should follow
4. ROADMAP.xml has a coherent phase plan
5. An eval agent reading only these docs could build a functional equivalent
