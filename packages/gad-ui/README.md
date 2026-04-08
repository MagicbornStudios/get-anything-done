# gad-ui (not a product)

This folder is **not** a planned or supported npm package. It exists only as a **named placeholder** in the get-anything-done tree so nobody assumes a committed roadmap for “official GAD React components.”

## Why there is no GAD UI framework (for now)

RepoPlanner shipped host-mountable React surfaces (`repo-planner/host`, cockpit, planning-pack) and tried to track a moving planning format. **Planning schema and CLI output kept changing faster than a separate UI package could reasonably track.** Maintaining parity became the bottleneck.

Separately, experience with **GAD** suggests that a **very rigid, architecture-heavy workflow** is often *worse* for real teams than a lighter loop — even when the heavier system is elegant on paper. RepoPlanner’s product shape was in many ways **stronger as a planning UX** than early GAD rigidity. We still moved to **GAD** because **tooling, monorepo wiring, and shared planning docs** are simpler to operate day to day.

A possible **“GAD-lite”** inspired by RepoPlanner’s implementation is an **open research topic**, not a committed effort, and there is **no promise** of a first-party UI layer for the GAD framework.

## Reference only

For **cockpit + CLI patterns**, see the **portfolio** app’s `repo-planner` dependency and the **RepoPlanner** submodule (upstream `main` = pre-skills framework; see monorepo `.planning/REPOPLANNER-TO-GAD-MIGRATION-GAPS.md`). Treat as **read-only reference**, not something we will keep in sync with GAD releases.

## `packages/ui`

An umbrella `packages/ui` is **not planned** — only an idea, for the same reasons RepoPlanner’s UI struggled with format churn.
