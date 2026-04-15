---
name: build-and-release-locally
description: Cut a new GAD release — version bump, CHANGELOG entry, Node SEA rebuild, git tag, and `gh release create` with artifacts attached. Operator-triggered only, no CI, no npm publish. Trigger this skill whenever the user asks to "cut a release", "ship v<N>", "publish a new release", "bump the version", or any variation that means "the canonical GAD repo should have a new downloadable installer artifact on GitHub Releases." Canonical-repo-only: refuses to run outside the MagicbornStudios/get-anything-done clone. See decision gad-188 (44-28 umbrella — distribution is GitHub Releases + executable download, no GitHub Actions).
---

# build-and-release-locally

This is the procedure for cutting a GAD release from the operator's workstation. There is no CI. There is no `npm publish`. The only distribution channel is GitHub Releases on `github.com/MagicbornStudios/get-anything-done`, and the only way to populate it is to run this skill end-to-end on a machine that has Node, `gh`, and `git` installed, with push access to the canonical repo.

## When to trigger this skill

- User asks to "cut a release", "ship v<N>", "publish a new release", "bump the version to <N>".
- Task 44-31 or any downstream Track B installer task (44-32/33/34) is blocked waiting for a release to exist.
- CHANGELOG `[Unreleased]` section has accumulated enough material to warrant a new version, and the user confirms they want to publish.
- A downstream consumer (eval runner, someone installing GAD into their repo) needs a fresh `installer.exe` and the last published release is materially stale.

## When NOT to trigger this skill

- In-progress work on a feature branch — releases come from `main` after the work is merged.
- When `dist/release/gad-v*.exe` is already current and only docs or planning changed — a release is not required for every commit.
- When running inside a consumer project (the canonical-repo gate will refuse).
- When the user asks to publish to npm — GAD does not ship to npm. Explain and refuse.

## Hard gates before you start

1. **Canonical repo check.** Run `git config --get remote.origin.url` and confirm it matches `MagicbornStudios/get-anything-done(.git)?`. If not, refuse: the operator is in a consumer project and this skill cannot run.
2. **Branch check.** Confirm `git branch --show-current` is `main` and `git status --porcelain` is empty. Releases come from a clean `main`. If there are uncommitted changes, list them and stop — the operator decides whether to commit/stash/discard before you proceed.
3. **Tool availability.** Confirm `node --version`, `gh --version`, and `git --version` all return. If `gh` is missing or unauthenticated (`gh auth status`), stop and print the install/auth instructions.
4. **Fetch.** Run `git fetch --tags` so local tag state matches the remote. If a tag with the target version already exists, refuse — version bumps must be monotonic.
5. **Dependencies.** Run `npm install` (or confirm `node_modules/` + `node_modules/.bin/postject` exists). The SEA build depends on `postject` being installed locally.

## Procedure

### Step 1 — Decide the new version

Read `package.json` `version` field and propose the next version following semver:

| Change type | Bump |
|---|---|
| Breaking CLI surface, removed commands, schema renames | MAJOR |
| New commands, new subcommands, new decisions, new skills | MINOR |
| Bug fixes only, no new surface | PATCH |

Confirm the chosen version with the operator before editing files. The operator can override.

### Step 2 — Bump version in package files

Edit both:

- `package.json` — update `version` field
- `package-lock.json` — update BOTH top-level `version` AND the `packages[""].version` field

Use the `Edit` tool, not a manual `npm version` call — npm version creates a commit + tag unprompted, which collides with this skill's control flow.

### Step 3 — Write the CHANGELOG entry

Edit `CHANGELOG.md`. Keep the structure:

```
## [Unreleased]

## [<new-version>] - <YYYY-MM-DD>

<one-paragraph summary of the release>

### Added
- …

### Changed
- …

### Fixed
- …

### Contract notes (optional)
- …
```

Source material: `git log --oneline <previous-tag>..HEAD` if there is a previous tag, or `git log --since=<previous-release-date> --oneline` if not. Group commits by subsystem (CLI, site, framework, release pipeline, eval framework). Cite decision IDs (`gad-NNN` / `GAD-D-NNN`) and task IDs (`NN-NN` / `GAD-T-NN-NN`) where relevant — the changelog is a primary durable record of WHY changes happened.

Keep it concise but thorough. A release with 300+ commits warrants a long changelog section; a patch release warrants 5 lines.

### Step 4 — Rebuild the release artifact

```sh
npm run build:release
```

This runs `scripts/build-release.mjs` which:

1. Calls `scripts/build-hooks.js` (compile hook shims).
2. Calls `scripts/build-cli.mjs` (bundle CLI entrypoints).
3. Calls `scripts/build-release-support.mjs` (build the support tree of skills, commands, templates, references bundled into the SEA blob).
4. Generates `sea-config-<platform>-<arch>.json` via `--experimental-sea-config` and emits `sea-prep-<platform>-<arch>.blob`.
5. Copies `process.execPath` (the running Node binary) to `dist/release/gad-v<version>-<platform>-<arch>.exe`.
6. Injects the SEA blob into the executable via `postject` with sentinel fuse `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`.
7. On Windows, also copies `scripts/install-gad-windows.ps1` and writes a fresh `dist/release/INSTALL.txt` with the correct artifact name and invocation instructions.

Cross-platform note: `build-release.mjs` refuses to cross-build. Windows artifacts must be built on Windows, macOS on macOS, Linux on Linux. If the operator needs multi-platform artifacts, they must run the skill on each target OS and upload to the same tag.

**Verify the build** before committing:

```sh
ls -la dist/release/
./dist/release/gad-v<version>-windows-x64.exe --version    # on Windows
./dist/release/gad-v<version>-<platform>-<arch> --version  # on macOS/Linux
```

The version output must match the version you just bumped to. If it reports the old version, the SEA blob did not rebuild — investigate `scripts/build-release-support.mjs` and the esbuild cache.

### Step 5 — Commit the release

```sh
git add package.json package-lock.json CHANGELOG.md
git commit -m "release: v<version>"
```

Do NOT commit `dist/` — it is gitignored. The artifact lives only in GitHub Releases.

### Step 6 — Tag

```sh
git tag -a v<version> -m "GAD v<version>"
```

Annotated tag, not lightweight — the tag message is what `gh release create --generate-notes` picks up if no `--notes-file` is given.

### Step 7 — Push commit + tag

```sh
git push origin main
git push origin v<version>
```

If the operator is working in a monorepo where `vendor/get-anything-done/` is a git submodule (this is the current reality in `custom_portfolio`), the push is from INSIDE the submodule, not from the outer repo. The outer repo's submodule pointer will need a separate commit in a follow-up step — but that is the consumer's job, not this skill's.

**This is the visible, shared-state step.** Before pushing the tag, explicitly confirm with the operator. The tag push triggers the release in step 8 and is not trivially reversible (deleting a tag that downstream consumers have already fetched is bad form). If the operator approved "cut a release" but did not explicitly approve "push the tag now," pause and ask.

### Step 8 — Create the GitHub release

```sh
npm run publish:release
```

This runs `scripts/publish-release.mjs` which:

1. Reads the current `package.json` version and derives `v<version>` as the tag.
2. Checks `gh release view v<version>` — if the release already exists, skips the create step.
3. Otherwise runs `gh release create v<version> --title "GAD v<version>" --generate-notes`.
4. Uploads every artifact in `dist/release/` matching `gad-v*` or `install-gad-windows.ps1` or `INSTALL.txt` via `gh release upload --clobber`.

`--clobber` means re-running the skill after fixing a bad artifact is safe: the upload replaces the existing asset at the same name.

**Alternative**: to attach a richer body than `--generate-notes`, pass `--notes-file` pointing at a temporary file containing the CHANGELOG section you wrote in step 3:

```sh
node scripts/publish-release.mjs --notes-file /tmp/release-notes-v<version>.md
```

### Step 9 — Verify

```sh
gh release view v<version>
gh release view v<version> --json assets --jq '.assets[].name'
```

Confirm the tag exists, the title is correct, and every expected artifact is attached. Open the URL in a browser if the operator wants a visual check:

```sh
gh release view v<version> --web
```

### Step 10 — Update planning docs

Edit `.planning/STATE.xml` `<next-action>` to reflect that the release is cut. If the release closes a task, update `.planning/TASK-REGISTRY.xml` — set `status="done"`, `skill="build-and-release-locally"`, `agent="default"`, `type="framework"`. Capture any new decisions in `.planning/DECISIONS.xml` (e.g. version cadence policy, what went into the release notes).

Commit the planning-doc updates separately from the release commit — the release commit should be minimal (version files + CHANGELOG only).

## Common failure modes

| Failure | Cause | Fix |
|---|---|---|
| `postject: command not found` | `node_modules/.bin/postject` missing | `npm install` from vendor root |
| `Cross-platform SEA builds must run on the target platform/arch` | Operator passed `--platform` / `--arch` that doesn't match the host | Re-run on the target OS, or drop the flags |
| `gh: command not found` | `gh` CLI not installed | Install from `https://cli.github.com` |
| `gh auth status: not logged in` | `gh` not authenticated | Run `gh auth login`, pick HTTPS or SSH, follow the prompts |
| Release exists, upload fails with 422 | Previous run uploaded bad artifacts | `gh release upload <tag> ... --clobber` (already the default in `publish-release.mjs`) |
| Exe reports old version after rebuild | Stale SEA blob, esbuild cache, or support-tree pre-cache | `rm -rf dist/ && npm run build:release` |
| `postject: Multiple occurences of sentinel "NODE_SEA_FUSE_..." found in the binary` | **Node 24+ incompatibility with postject `1.0.0-alpha.6`.** Node 24's own `node.exe` contains the SEA sentinel string twice, and postject alpha.6 refuses to inject when it finds more than one occurrence. The SEA blob is built correctly; only the inject step fails. Confirmed locally with Node v24.13.0 + postject 1.0.0-alpha.6 on 2026-04-14. | Build on Node 20.x. Install Node 20 portable (`https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip`), extract alongside the repo, and run `<node20-dir>\node.exe scripts/build-release.mjs`. `build-release.mjs` uses `process.execPath` as the SEA base, so the Node version that runs the script is the Node version that becomes the base exe. Alternative: upgrade postject once a fixed version ships. Do NOT attempt to patch `node.exe` to remove the extra sentinel — that invalidates the Authenticode signature and Windows Defender will flag it. |
| `esbuild: No loader is configured for ".node" files` (onnxruntime-node) | Optional embedding backend (`@huggingface/transformers`) transitively pulls native `.node` binaries that esbuild can't bundle. Fixed 2026-04-14 in `scripts/build-cli.mjs` by adding `@huggingface/transformers`, `onnxruntime-node`, `onnxruntime-common`, `onnxruntime-web`, `sharp` to the esbuild `external` list. | If this regresses, re-apply the fix. Optional deps that ship native bindings must always be externals in the SEA bundle — the packaged exe runs without embeddings and falls back to Jaccard ranking in `gad snapshot`. |
| Tag push rejected | Someone else tagged first, or local is behind | `git pull --rebase origin main && git fetch --tags` and re-verify version |
| Build-release succeeds but exe won't launch on Windows | Windows Defender or SmartScreen blocked an unsigned binary | Expected for unsigned releases; instruct consumers to right-click → Properties → Unblock. Code-signing is a separate decision not covered here. |

## Contract with 44-28 umbrella

This skill is the B0 foundation of the Track B installer pipeline (decision gad-188). Downstream tasks that depend on a consumable release:

- **44-32 / B2** — `bin/install.js` `--from-release <url|tag>` flag needs a real release to pull from.
- **44-33 / B3** — Site packaging produces a `site-<version>.zip` artifact uploaded alongside the installer.
- **44-34 / B4** — Portable Node bootstrap ships a `node-v<N>-<platform>.zip` artifact uploaded alongside the installer.

Every one of those downstream tasks **adds a new artifact** to the release. The shape of `publish-release.mjs`'s `getArtifacts()` filter (`/^gad-v.+/` + explicit install files) may need to widen when B2/B3/B4 land — revise this skill at that point.

## Guardrails — things this skill MUST NOT do

1. **Never run `npm publish`.** GAD is not on npm. If the operator asks, explain and refuse.
2. **Never trigger CI / GitHub Actions.** There is no CI. This skill is the only release path.
3. **Never force-push to `main`.** If the release commit fails a hook, fix the underlying problem and create a new commit — do not `git push --force`.
4. **Never delete a published tag.** If a release is bad, cut a new version that fixes it. Deleting published tags breaks downstream consumers.
5. **Never run outside the canonical repo.** The gate in step 1 is load-bearing. Consumer projects should use `gad skill promote --project` to equip skills, not this skill.
6. **Never push the tag without explicit operator confirmation in the conversation where the skill is running.** The `git push origin v<version>` step is the point of no return.
