# Sweep E failures (operator callout 2026-04-19)

**Agent:** opus-claude

**Source:** session 2026-04-19 sweep E callout

## What went wrong

1. **Polluted vendor/CLAUDE.md with sweep logs + implementation pattern.**
   CLAUDE.md is the framework's user-facing navigation/usage guide.
   Adding a 50-line 'Modular commands (post-2026-04-19, sweep E)'
   section with a how-to recipe, a 'Dead-code traps in bin/gad.cjs'
   sweep-D log, and a 'Diff hygiene (post-2026-04-19 sweeps)' tag was
   wrong — those are implementation details / changelogs, not navigation.

   Operator quote: 'wtf are you editing the claude.md for in the
   framework. unnacceptable. take note of your failure then continue.
   that is a file to be used on how to navigate and use the framework
   itself and not supposed to have logs and implementation details.
   you broke the file further if it was already broken.'

   **Rule going forward.** vendor/CLAUDE.md describes how to USE the
   framework — timeless, no sweep tags, no changelog, no internal
   implementation. Sweep narratives go in .planning/notes/. Contributor
   patterns (how to extract a command family, how to add a new
   command) go in references/contributing-*.md, not CLAUDE.md.

2. **Underwhelming LOC reduction.** Only -256 LOC in sweep E. For a
   pass labeled 'systematic, keep doing passes' that's not enough.
   Need to be more aggressive — extract more command families per
   pass, not 3 small ones.

## Corrective actions in this same pass

- Rewrite vendor/CLAUDE.md back to clean navigation. Strip sweep-D
  + sweep-E log content. Move the 'how to extract a command family'
  recipe to references/contributing-modular-commands.md.
- Continue sweep E (extending it) — extract phases / decisions /
  handoffs / requirements / errors / blockers / refs into
  bin/commands/. Target -1000+ LOC this pass.

## Lesson

Three docs surfaces in this repo, easy to confuse:

| File | Purpose | What goes in it |
|---|---|---|
| AGENTS.md | full agent guidance for the submodule | timeless usage reference |
| CLAUDE.md (vendor) | short list of submodule-specific gotchas | timeless navigation only |
| .planning/notes/ | session logs, sweep narratives, design docs | temporal / dated content |
| references/ | contributor-facing reference docs | how to extend the framework |

If I'm tempted to write 'post-YYYY-MM-DD' or 'sweep X' in CLAUDE.md,
I'm in the wrong file.
