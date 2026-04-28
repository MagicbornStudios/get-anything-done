---
name: scaffold-local-dev-editor-bridge
description: >-
  Scaffold a NODE_ENV-gated local-dev authoring surface with a dev-server
  command bridge and file-system round-trip adapter. Three-pane shell
  scaffolds first (with VCS cids round-tripped before features), bridge
  ships permissive then hardens to an allow-list, file-system writes are
  scoped to the active project. Use for Project Editor / Brood Editor /
  any agent-facing surface that spawns CLI commands from the browser.
status: proto
workflow: ./workflow.md
---

# scaffold-local-dev-editor-bridge

Local-dev authoring surfaces share three load-bearing primitives: a
NODE_ENV gate that hard-fails at module load, a dev-server command
bridge that streams subprocess output via SSE, and a file-system
round-trip adapter scoped to the current project. Phase 44.5 found
these are independent enough to scaffold separately and risky enough
to require strict ordering — VCS round-trip first, then the bridge, then
the file adapter.

This skill is the canonical sequence + guardrail set. The DNA Editor
(`build-dna-editor-surface`) is one client of this scaffold; the Brood
Editor and any future authoring surface should follow the same shape.

**Workflow:** [./workflow.md](./workflow.md)

## Provenance

- Source candidate: `.planning/candidates/phase-44.5-project-editor-brood-editor-local-dev-ga/CANDIDATE.md`
- Drafted: 2026-04-28 by `create-proto-skill`
- See [PROVENANCE.md](./PROVENANCE.md)
