---
name: gad:reverse-engineer
description: Analyze any codebase (local path or GitHub URL) and produce GAD planning docs for clean-room reimplementation. Removes dependencies by capturing requirements, not code.
---

# gad:reverse-engineer

Analyzes an existing codebase and produces structured GAD planning docs (REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml) that capture what was built, why, and how. The output is a complete project scaffold ready for clean-room reimplementation without the original dependency.

**Primary use case: dependency removal.** Point at a library you depend on, extract what it does as requirements, then implement your own version from the spec.

## When to use

- Removing a dependency by reimplementing it from requirements
- Reverse-engineering an existing project to create eval requirements
- Analyzing a GitHub repo you want to understand and replace
- Creating a license-safe specification from a reference implementation

## What it produces

1. **REQUIREMENTS.xml** — structured requirements with testable success criteria
2. **DECISIONS.xml** — architectural decisions inferred from code patterns
3. **CONVENTIONS.md** — coding conventions observed in the codebase
4. **ROADMAP.xml** — suggested phase breakdown for re-implementation
5. **CONTEXT.md** — key context about the project's purpose, stack, and design

## What it does NOT produce

- No copied source code (license-safe, clean-room)
- No line-for-line implementation details
- No proprietary algorithms — only WHAT was built, not HOW

## Step 1 — Acquire the target

### Local path
```sh
# Entire repo
gad reverse-engineer --path vendor/some-library

# Specific subdirectory
gad reverse-engineer --path vendor/some-library/src/core
```

### GitHub URL (clone to temp)
```sh
# Full repo
gad reverse-engineer --repo https://github.com/org/project

# Specific branch
gad reverse-engineer --repo https://github.com/org/project --branch main

# GitHub URL with path (e.g. from browser)
gad reverse-engineer --repo https://github.com/org/project/tree/main/src/core
```

For GitHub URLs:
1. Clone to a temp directory: `git clone --depth 1 <url> /tmp/gad-re-<name>`
2. If the URL includes a path (e.g. `/tree/main/src/core`), scope analysis to that subdirectory
3. Read-only — never push to or modify the cloned repo
4. Clean up temp directory when done

## Step 2 — Deep analysis (multiple passes)

Do NOT rush this step. The quality of the output depends on thorough analysis. Make multiple passes through the codebase.

### Pass 1: Orientation
- README, package.json, entry points
- What is this project? Who uses it? What problem does it solve?
- File tree structure — how is it organized?

### Pass 2: Public API surface
- What does this expose to consumers? Exports, types, functions, components
- Read the index.ts/index.js — what's the public contract?
- Look at TypeScript declarations (.d.ts) if they exist
- Check examples/ or docs/ for intended usage patterns

### Pass 3: Core systems
- Read every major module/file — understand what each one does
- Map the data flow: what creates data, what transforms it, what renders it
- Identify the state management approach
- Identify external integrations (APIs, databases, services)

### Pass 4: Edge cases and non-obvious behavior
- Look at tests — they reveal edge cases the code handles
- Look at error handling — what can go wrong?
- Look at configuration — what's tunable?
- Look at migration/upgrade code — what changed over time?

### Pass 5: Dependencies and their roles
- For each dependency in package.json, understand WHY it's there
- Which dependencies are core to the architecture vs convenience?
- Which could be replaced with simpler alternatives?

## Step 3 — Produce requirements

Write REQUIREMENTS.xml. **Every observable feature becomes a testable criterion.**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<requirements>
  <goal>One-sentence project purpose</goal>
  <audience>Who uses this and how</audience>

  <success-criteria>
    <!-- One criterion per observable feature. MUST be testable. -->
    <criterion id="sc-01">Description of user-facing capability</criterion>
  </success-criteria>

  <non-goals>
    <item>What this project explicitly doesn't do</item>
  </non-goals>

  <core-systems>
    <system id="name">What this system does, inputs/outputs, key interfaces</system>
  </core-systems>

  <stack>
    <item>Framework/library — why it's used, what role it fills</item>
  </stack>
</requirements>
```

### Requirements quality checklist
- [ ] Every user-facing feature has a criterion (not just the obvious ones)
- [ ] Each criterion is testable — an agent can verify pass/fail
- [ ] Each system describes WHAT not HOW
- [ ] Stack items include the WHY
- [ ] Non-goals are explicit (prevents scope creep during reimplementation)
- [ ] At least 20 criteria for a substantial library, 50+ for a large one

## Step 4 — Infer decisions

Write DECISIONS.xml with **every architectural choice** you can observe:

```xml
<decision id="re-01">
  <title>Choice observed</title>
  <summary>What was chosen, evidence of why</summary>
  <impact>How this constrains re-implementation</impact>
</decision>
```

Look for: framework choices, state management, data model design, UI architecture, build tooling, testing strategy, error handling philosophy, performance optimizations.

## Step 5 — Extract conventions

Write CONVENTIONS.md: file structure, naming, imports, code style, content/data formats, component patterns.

## Step 6 — Suggest roadmap

Write ROADMAP.xml with phases in dependency order. First phase is always foundation (types, build, scaffold). Last phase is always public API and exports.

## Step 7 — Write context

Write CONTEXT.md summarizing what you learned — the non-obvious insights that don't fit in structured docs.

## Step 8 — Create eval project (optional)

```sh
gad eval setup --project <name>
```

Copy REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml into the eval template. An agent reading only these docs should be able to build a functional equivalent.

## Definition of done

1. REQUIREMENTS.xml covers every observable feature (20+ criteria)
2. DECISIONS.xml captures 5+ architectural choices
3. CONVENTIONS.md documents patterns for the re-implementation
4. ROADMAP.xml has a coherent phase plan in dependency order
5. An eval agent reading only these docs could build a functional equivalent
6. No source code was copied — only requirements and architecture
