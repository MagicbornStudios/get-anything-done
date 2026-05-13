# Handoff Clusters: Production-Driven Configuration Taxonomy

This document defines the natural "clusters" of handoff configurations identified during the Phase 112 Orthogonality Audit (2026-05-04). 

Instead of enumerating all 162 theoretical combinations of `--context`, `--risk`, `--time`, and `--surface`, we use these 6 validated archetypes to drive evaluation, testing, and agent prompting.

## The Production Clusters

| Cluster ID | Context | Risk | Time | Surface | Description |
|------------|---------|------|------|---------|-------------|
| **C1: Mechanical** | prescribed | safe | standard | local | Pure execution of a spec. No architectural decisions needed. |
| **C2: Reasoning** | exploratory | safe | standard | local | Standard engineering task involving problem-solving and implementation. |
| **C3: Design** | design | safe | deep | local | High-level planning, architecture, or aesthetic work. Needs quality over speed. |
| **C4: Bounded** | bounded | safe | standard | local | Implementation within a specific, well-defined boundary or submodule. |
| **C5: Audit** | audit | safe | standard | local | Verifying state, checking compliance, or reviewing existing work. |
| **C6: Critical** | prescribed | destructive | standard | local | Execution tasks that touch sensitive files or state (Safety Test). |

## Dimension Defaults & Production Distribution

As of 2026-05-04 (n=157):

- **Risk:** 100% of production work is `safe`. Non-safe work is theoretical/future.
- **Surface:** 100% of production work is `local`.
- **Time:** 97% is `standard`. `deep` is reserved for `design` or complex `exploratory` work.
- **Context:** Dominated by `exploratory` (55%) and `prescribed` (30%).

## Implementation Guidance

### 1. Eval Matrix
Evaluations should run across the 6 clusters above, plus variations in `runtime_preference`. This reduces the testing surface from 162 to ~10-15 high-value test cases.

### 2. Prompting
The `lib/team/prompt.cjs` logic should continue to use the individual flags to generate constraint banners, but the **Worker Loop** should prioritize these clusters when selecting runtimes or allocating token budgets.

### 3. Handoff Creation
The `gad handoffs create` command should hint at these clusters while still allowing full orthogonality for advanced users.

## Taxonomy Refresh (2026-05-04)

- `mechanical` (alias for `prescribed`)
- `reasoning` (alias for `exploratory`)
- `safe` (default risk)
- `standard` (default time)
- `local` (default surface)
