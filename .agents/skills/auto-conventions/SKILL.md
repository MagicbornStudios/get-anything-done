---
name: gad:auto-conventions
description: Auto-generate CONVENTIONS.md from codebase patterns after first implementation phase. Use for greenfield projects that have code but no documented conventions.
---

# gad:auto-conventions

Scans the codebase and generates a CONVENTIONS.md capturing the patterns the agent established during implementation. This runs after the first phase that produces code.

## When to use

- After completing the first implementation phase of a greenfield project
- When .planning/CONVENTIONS.md does not exist
- When the project has source files but no documented patterns

## What it captures

Scan the project's source files and document:

### 1. File structure
```
List the directory layout:
  src/
    main.ts          — entry point
    types.ts         — shared type definitions
    content/         — JSON/TS content packs
    scenes/          — KAPLAY scenes (one per file)
    systems/         — game state and logic
```

### 2. Naming conventions
- File naming: kebab-case, camelCase, PascalCase?
- Export naming: default exports vs named exports
- Type naming: interfaces vs types, prefix conventions (I-prefix?)
- Content pack naming: how data files are named and organized

### 3. Import patterns
- Relative imports vs aliases
- Barrel files (index.ts) or direct imports
- Content imports: inline data vs JSON files vs TypeScript constants

### 4. Code patterns
- Function style: arrow functions vs function declarations
- Module pattern: classes vs functions vs object literals
- Error handling: try/catch, result types, assertions
- State management: global state, context passing, pub/sub

### 5. Content pack format
- How game/app data is structured
- Type definitions for content
- Loading and validation patterns

### 6. Build and verify commands
```sh
npm run dev        # development server
npx tsc --noEmit   # type check
npm run build       # production build
```

## Steps

1. **Check if CONVENTIONS.md exists** — if yes, skip (don't overwrite human edits)

2. **Scan source files**
   ```sh
   find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" | head -30
   ```

3. **Read 5-10 representative files** — entry point, type definitions, one content file, one component/scene, one system/utility

4. **Extract patterns** from what you read:
   - How are files organized?
   - What naming conventions are used?
   - How are imports structured?
   - What code patterns repeat?

5. **Write .planning/CONVENTIONS.md**

## Template

```markdown
# Conventions

Generated from codebase scan on [date]. Update as patterns evolve.

## File structure
[directory layout with purposes]

## Naming
- Files: [pattern]
- Exports: [pattern]
- Types: [pattern]

## Imports
[import patterns and rules]

## Code patterns
[common patterns observed]

## Content packs
[how data is structured]

## Build
[build and verify commands]
```

## After generation

The conventions appear in `gad snapshot` output (via the CONVENTIONS section). Future agents see them immediately on session start.
