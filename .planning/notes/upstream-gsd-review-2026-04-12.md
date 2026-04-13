# Upstream GSD Review — 2026-04-12

Source refreshed from `.tmp/get-shit-done` at upstream commit `c11ec0555451338c3ef666753ec2b24731d7a2c7`.

## What changed upstream recently

- The repo advanced materially after our earlier clone.
- The SDK gained a large `sdk/src/query/` surface with query handlers for init, phase lifecycle, roadmap, state, profile, verify, validate, workspace, and workstream operations.
- Workstreams are real upstream code now, not just docs:
  - `get-shit-done/bin/lib/workstream.cjs`
  - `sdk/src/query/workstream.ts`
  - `tests/workstream.test.cjs`
- Security remains centralized in `get-shit-done/bin/lib/security.cjs`.
- README remains significantly more expansive than GAD’s current README.

## Workstreams: what upstream actually built

Upstream workstreams are planning namespaces under `.planning/workstreams/<name>/`.

The implementation concept is:

- Shared root remains at `.planning/`
- Per-workstream files move under `.planning/workstreams/<name>/`
- Scoped files include:
  - `ROADMAP.md`
  - `STATE.md`
  - `REQUIREMENTS.md`
  - `phases/`
- Shared files stay at root:
  - `PROJECT.md`
  - `config.json`
  - `milestones/`
  - `research/`
  - `codebase/`
  - `todos/`

Supported upstream operations:

- create
- list
- status
- set/get active workstream
- progress
- complete/archive
- migration from flat mode into workstream mode

Important design points:

- Flat mode remains supported when `.planning/workstreams/` does not exist.
- Active workstream is stored in `.planning/active-workstream`.
- Session-scoped selection is also supported in tests via `GSD_SESSION_KEY`.
- Path traversal protections exist around workstream names.

## Workstreams: initial judgment for GAD

Good ideas worth reviewing:

- Backward-compatible flat mode fallback
- Explicit migration from flat planning into namespaced workstreams
- Session-scoped active workstream selection
- Progress/status commands across workstreams
- Path validation around namespace names

Risks / likely overengineering:

- Workstreams add another planning indirection before we have settled the simpler monorepo + eval + planning-root story in GAD
- Shared-vs-scoped file split introduces additional mental model cost
- We need to decide how workstreams interact with:
  - root planning
  - multi-root planning
  - eval preservation
  - runtime tracing
  - site reporting

Conclusion:

- Workstreams look viable and real, not fake documentation residue
- We should not import them blindly
- GAD should review and likely adopt a simplified version if we add them

## Security: what upstream has that GAD should keep or port

`get-shit-done/bin/lib/security.cjs` is still one of the strongest upstream modules.

It centralizes:

- path traversal prevention
- safe path resolution
- prompt injection scanning
- prompt sanitization
- display sanitization
- shell argument validation
- safe JSON parsing

Notable strengths:

- clear threat model at the top of the file
- prompt-injection patterns are treated as defense-in-depth, not perfect security
- sanitizers are separated by use case (`sanitizeForPrompt`, `sanitizeForDisplay`)
- path validation accounts for symlink resolution and containment

Judgment:

- We should restore or port this capability into GAD as a first-class shared module
- This is one of the highest-confidence upstream ideas to carry forward

## SDK: what looks good upstream

The upstream SDK is now more than a thin runner.

What stands out:

- query handler split is clearer than a giant all-purpose CLI bridge
- many operations are individually test-covered
- workstream, workspace, state, roadmap, verify, validate, and init logic are separable units
- the SDK is becoming a true headless orchestration surface rather than just a wrapper

Potential value for GAD:

- a query-oriented SDK surface could be a cleaner canonical core than today’s mixed CLI/runtime/tooling boundaries
- query handlers are a promising shape for:
  - site data generation
  - eval automation
  - runtime adapters
  - future API/server surfaces

Risks:

- upstream also appears to be growing fast in surface area
- we need to distinguish "good decomposition" from "too many commands and too much ceremony"
- we should prefer adopting the shape and modularity, not necessarily every command or workflow

## README: what makes upstream’s README stronger

Upstream README is stronger in breadth and onboarding density.

What it does well:

- strong top-of-file framing
- larger install matrix
- clearer "who this is for" explanation
- visible feature highlights / release highlights
- detailed install/update/troubleshooting/security sections
- comprehensive command surface documentation and compatibility notes

What GAD should copy in spirit:

- more complete install paths
- clearer runtime support matrix
- richer troubleshooting / updating guidance
- explicit security section
- stronger explanation of what the framework is for and how it differs from generic coding-agent usage

What GAD should not copy directly:

- upstream branding/tone
- token/community/promotional framing
- command duplication if the command surface is no longer canonical in GAD

## Immediate recommendations

1. Keep `.tmp/get-shit-done` refreshed and use it as a standing comparison target.
2. Review upstream workstreams before implementing GAD workstreams.
3. Port or reintroduce the security module concepts into GAD.
4. Review the upstream SDK query split as a candidate architecture for GAD’s canonical core.
5. Expand GAD README toward upstream-level completeness, but with GAD’s current install/runtime/canonical-source truth.
