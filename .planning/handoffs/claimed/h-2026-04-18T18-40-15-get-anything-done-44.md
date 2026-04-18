---
id: h-2026-04-18T18-40-15-get-anything-done-44
projectid: get-anything-done
phase: 44
task_id: 44-38
created_at: 2026-04-18T18:40:15.537Z
created_by: unknown
claimed_by: unknown
claimed_at: 2026-04-18T18:50:00.981Z
completed_at: null
priority: high
estimated_context: reasoning
runtime_preference: codex
---
# 44-38 — Tarball distribution (replace npm 404 with GitHub Releases)

Blocks every user running /gad-update today. High priority; touches codex lane.

## Before you start

1. Read `references/agent-lanes.md` — codex lane owns `bin/gad.cjs`, `bin/install.js`, runtime. Hooks (`hooks/gad-check-update.js`) are infrastructure — coordinate if you touch Claude-code-specific hook logic.
2. Read TASK-REGISTRY.xml line for 44-38 (full goal) — `node bin/gad.cjs tasks --projectid get-anything-done --full | grep -A 5 44-38`.

## What's broken

- `hooks/gad-check-update.js:91` — `npm view get-anything-done version` 404s (package not on npm public registry).
- `workflows/update.md` — lines 149, 156, 255, 260, 265 all invoke `npx -y get-anything-done@latest` which also 404s.

## Implementation

### (a) Replace version-check source in `hooks/gad-check-update.js`

Swap `npm view` with GitHub Releases API. Preferred path:
```js
latest = execSync('gh api repos/<owner>/<repo>/releases/latest --jq .tag_name', {...}).trim();
```

Fallback when `gh` missing: `git ls-remote --tags <origin-url>` and pick the highest semver tag.

Bake the repo slug into a constant or read from `package.json.repository`. Do NOT hardcode a GitHub org in a place that a fork can't override — make it configurable via `GAD_RELEASE_REPO` env.

### (b) Replace install path in `workflows/update.md`

Replace each `npx -y get-anything-done@latest "$FLAG"` with:

```sh
tmp=$(mktemp -d)
gh release download "$VERSION" --repo "$REPO" --pattern 'get-anything-done-*.tgz' --dir "$tmp"
tar -xzf "$tmp"/get-anything-done-*.tgz -C "$tmp"
node "$tmp/package/bin/install.js" "$FLAG"
```

Keep the existing backup + reapply-patches flow intact (survives an install that lands new core + custom patches).

### (c) Ensure a tarball exists

Check if `build-and-release-locally` skill (skills/build-and-release-locally/SKILL.md) already produces a tarball on release. If not, add a step that runs `npm pack` (or equivalent) and uploads the `.tgz` as a GitHub Release asset. Without this, the install flow has nothing to download.

### (d) Version-compare against git tag, not npm

Update `gad-check-update.js` comparison path to read the tag list directly.

## Acceptance

- On a clean machine with no prior vendor checkout, `/gad-update` (or the equivalent runner) completes without touching npm.
- `gad --version` reports the latest tag after update.
- Existing local patches survive (reapply-patches still works).

## When done

Release a new tag (v1.34.0 probably, or whatever's next) with the tarball asset attached, then `gad handoffs complete <this-id>`. Run `gad install` from source locally to confirm the new binary has `gad handoffs`, `gad tasks update --goal`, and the idempotent `gad phases add` fix (my phase 63 work sits in v1.33.0-pre — installed binary is still stale until your release ships).

## Why this matters

Every fix committed this sprint (60-09 handoff CLI, 63-06 regex idempotency, 63-03 user settings, 63-02 SessionStart hook nudge) is invisible to users until this tarball path works. This is the single largest leverage item for framework adoption.