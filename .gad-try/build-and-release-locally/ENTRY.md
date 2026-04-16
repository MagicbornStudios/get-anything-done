# build-and-release-locally — try entry

Staged by `gad try` on 2026-04-16.

## Where the sandbox is

The sandbox lives at `C:\Users\benja\Documents\custom_portfolio\vendor\get-anything-done\.gad-try\build-and-release-locally` (relative to whatever directory
you ran `gad try` in — the sandbox is always under `<cwd>/.gad-try/<slug>/`,
regardless of whether `gad` itself is globally or locally installed).

## How to run it

Open your coding agent (Claude Code, Codex, Cursor, Windsurf, etc.)
in **C:\Users\benja\Documents\custom_portfolio\vendor\get-anything-done** (the directory that contains `.gad-try/`) and paste:

```
Invoke the skill at .gad-try/build-and-release-locally/SKILL.md on this directory. Follow its instructions exactly. When done, tell me what artifacts it produced.
```

The exact prompt above was also copied to your clipboard when `gad try`
finished, if your OS has a clipboard tool installed (clip.exe on Windows,
pbcopy on macOS, xclip/xsel/wl-copy on Linux).

Or, if the skill ships its own slash command and is wired into your
runtime, use that command directly — the skill body will tell you what
syntax it expects.

## Where artifacts will land

Read `PROVENANCE.md` in this sandbox for declared outputs. If the skill
does not declare outputs, it will write to the current working directory —
likely producing files next to `.gad-try/`.

## When you're done

```sh
gad try cleanup build-and-release-locally    # remove this sandbox
```

If the skill installed system packages (pip / npm / brew), cleanup will
print the suggested uninstall commands but will NOT run them — you
decide whether to roll them back.
