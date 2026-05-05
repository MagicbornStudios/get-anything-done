# Proto-skill load paths by runtime

Per-runtime paths where `gad evolution install` places proto-skill bundles.
Researched 2026-05-05 against live host directories and runtime source conventions.

---

## claude-code

| Mode | Path |
|---|---|
| Local (project) | `<projectRoot>/.claude/skills/<slug>/SKILL.md` |
| Mirror (local) | `<projectRoot>/.claude/.agents/skills/<slug>/SKILL.md` |
| Global | `~/.claude/skills/<slug>/SKILL.md` |
| Global mirror | `~/.claude/.agents/skills/<slug>/SKILL.md` |
| Env override | `CLAUDE_CONFIG_DIR` replaces `~/.claude` |

Claude Code auto-discovers skills under `.claude/skills/` in the project root
and the global `~/.claude/skills/` directory. Both paths are populated by
`gad evolution install`.

---

## codex-cli

| Mode | Path |
|---|---|
| Local (project) | `<projectRoot>/.codex/skills/<slug>/SKILL.md` |
| Mirror (local) | `<projectRoot>/.codex/.agents/skills/<slug>/SKILL.md` |
| Global | `~/.codex/skills/<slug>/SKILL.md` |
| Global mirror | `~/.codex/.agents/skills/<slug>/SKILL.md` |
| Env override | `CODEX_HOME` replaces `~/.codex` |

Codex maintains a `~/.codex/skills/` directory (verified present on this host).
Skills are plain directories with `SKILL.md`. Codex does not have a native
"skill registry" separate from agent prompts; placing the file in `skills/`
makes it discoverable via `gad skill list` and injectable into AGENTS.md
context blocks. AGENTS.md injection (auto-referencing installed skills) is a
follow-up tracked in task 107-10.

---

## gemini-cli (antigravity)

| Mode | Path |
|---|---|
| Local (project) | `<projectRoot>/.agent/skills/<slug>/SKILL.md` |
| Mirror (local) | `<projectRoot>/.agent/.agents/skills/<slug>/SKILL.md` |
| Global | `~/.gemini/antigravity/skills/<slug>/SKILL.md` |
| Global mirror | `~/.gemini/antigravity/.agents/skills/<slug>/SKILL.md` |
| Env override | `ANTIGRAVITY_CONFIG_DIR` replaces `~/.gemini/antigravity` |

Gemini CLI runs through the `antigravity` layer. The native global config dir
is `~/.gemini/antigravity/`. Verified present on this host with
`brain/`, `conversations/`, `implicit/`, `knowledge/` subdirectories.
The `skills/` subdirectory is created by `gad evolution install` if absent.
The `runtime` key in `proto-skill-helpers.cjs` maps `antigravity` to this dir.

---

## opencode

| Mode | Path |
|---|---|
| Local (project) | `<projectRoot>/.agent/skills/<slug>/SKILL.md` (shared with antigravity local) |
| Global | `~/.config/opencode/skills/<slug>/SKILL.md` (created by install) |
| Env override | none discovered |

opencode does not expose a native skill registry at the CLI level (verified
2026-05-05: `~/.config/opencode/opencode.json` contains only permission and
schema settings; `~/.local/share/opencode/` holds session/message DB only).
`gad evolution install` writes skill files to the paths above so they are
co-located with the project or user config, making them findable for
AGENTS.md injection (task 107-10) and `gad skill list`. No `OPENCODE_*`
env var discovered; if the opencode project adds one, update `getProtoSkillGlobalDir`
in `lib/proto-skill-helpers.cjs`.

---

## cursor

**SKIPPED.** Cursor is not an active supported runtime per operator standing
rule (`feedback_no_cursor_provider.md`, 2026-05-05). Do not add Cursor to
`PROVIDERS`, `runtime-accounts.json`, or team profiles.

---

## Resolution order (gad evolution install)

1. `GAD_PROTO_SKILLS_DIR` env var — absolute path override for proto-skills source dir
2. `--projectid <id>` flag — resolves project root from `gad-config.toml`, reads
   `<projectRoot>/.planning/proto-skills/<slug>/`
3. `findRepoRoot()` — CWD walk up to nearest `gad-config.toml` / `.planning/config.json`;
   reads `<repoRoot>/.planning/proto-skills/<slug>/`
4. GAD vendor directory fallback — `vendor/get-anything-done/.planning/proto-skills/<slug>/`
   (framework-internal proto-skills only)

---

## Notes

- `--local` (default) resolves the native dir relative to CWD using the runtime's
  dotfile dir name (`.claude`, `.codex`, `.agent`, etc.).
- `--global` resolves to the user home config dir (`~/.claude`, `~/.codex`, etc.),
  or the `CLAUDE_CONFIG_DIR` / `CODEX_HOME` / `ANTIGRAVITY_CONFIG_DIR` env override.
- Both native (`<runtime>/skills/<slug>/`) and mirror (`.agents/skills/<slug>/`) paths
  are populated. The mirror path ensures non-Claude runtimes that read `.agents/`
  see the skill without additional configuration.
