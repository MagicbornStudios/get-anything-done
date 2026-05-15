# {{project_name}}

Claude Code entrypoint. **The source contract is `AGENTS.md` at the repo
root.** Read that file first — it is the authoritative agent contract
for `{{project_name}}` regardless of which runtime you are.

```
Read: ./AGENTS.md
```

Everything below is a Claude-only addendum. Anything that should apply
project-wide (loop, planning IDs, CLI reference) belongs in `AGENTS.md`.

## Claude-only notes

- Use `Skill <name>` to invoke installed project skills before the
  first edit when they match the task.
- The Claude harness exposes `Agent` (subagent dispatch), `TaskCreate`,
  and parallel tool calls — prefer them over sequential bash when work
  is independent.
- Do not preemptively scaffold runtime entrypoints for tools that
  aren't being used on this project (`.cursorrules`, `GEMINI.md`,
  `.opencode/AGENTS.md`, etc.). Add them only when that runtime is
  actually adopted, and keep them thin pointers back to `AGENTS.md`.
